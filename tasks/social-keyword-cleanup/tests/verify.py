#!/usr/bin/env python3
"""
Verifier for social-keyword-cleanup task (case_id=40).

The agent must:
  1. Read an email containing keyword deletion criteria ("giveaway" and "milestone")
  2. Log into the social media platform as mosi_brand
  3. Delete all published posts containing those keywords (case-insensitive)
  4. Leave non-matching posts intact

Seed state (all posts below belong to mosi_brand, author_id=1):
  - Post 9  (Layer 0): contains "giveaway" and "milestone"  -> should be deleted
  - Post 101 (Layer 1): contains "giveaway"                  -> should be deleted
  - Post 102 (Layer 1): contains "milestone"                 -> should be deleted
  - Post 103 (Layer 1): no keywords                          -> must survive

Other published posts from Layer 0 (1, 2, 4) do not contain the keywords and must survive.

Scoring:
  - Dimension 1 (0.5): All keyword-matching posts deleted (no published post by mosi_brand
    contains "giveaway" or "milestone")
  - Dimension 2 (0.5): Non-matching post 103 still published
"""

import json
import sys
import urllib.error
import urllib.request

SOCIAL_URL = "http://localhost:5004"

SOCIAL_USERNAME = "mosi_brand"
SOCIAL_PASSWORD = "demo123"

KEYWORDS = ["giveaway", "milestone"]

MOSI_BRAND_ACCOUNT_ID = 1
SHOULD_SURVIVE = {103}


def api_call(
    method: str,
    path: str,
    data: dict | None = None,
    token: str | None = None,
) -> dict:
    """Make an API call and return parsed JSON response."""
    url = f"{SOCIAL_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        raise Exception(f"HTTP {e.code}: {error_body}")


def content_matches_keywords(content: str) -> bool:
    """Check if content contains any of the target keywords (case-insensitive)."""
    lower = content.lower()
    return any(kw in lower for kw in KEYWORDS)


def main() -> tuple[float, dict]:
    score = 0.0
    details: dict = {"dimension_scores": {}, "messages": []}

    try:
        # Step 1: Login as mosi_brand
        login_resp = api_call(
            "POST",
            "/api/auth/login",
            {"username": SOCIAL_USERNAME, "password": SOCIAL_PASSWORD},
        )
        token = login_resp.get("session_token")
        if not token:
            raise Exception(f"No session_token in login response: {login_resp}")
        details["messages"].append(f"Logged in as {SOCIAL_USERNAME}")

        # Step 2: Get published posts by mosi_brand
        posts_resp = api_call(
            "GET",
            f"/api/posts?author_id={MOSI_BRAND_ACCOUNT_ID}&limit=100",
            token=token,
        )
        published_posts = posts_resp.get("posts", [])
        published_ids = {p["id"] for p in published_posts}

        details["messages"].append(
            f"Published posts by mosi_brand: {sorted(published_ids)}"
        )

        # Dimension 1: No published post by mosi_brand contains target keywords (0.5 pts)
        dim1_score = 0.0
        keyword_violations = []
        for p in published_posts:
            if content_matches_keywords(p["content"]):
                keyword_violations.append(
                    {"id": p["id"], "snippet": p["content"][:80]}
                )

        if len(keyword_violations) == 0:
            dim1_score = 0.5
            details["messages"].append(
                "PASS: No published posts contain target keywords"
            )
        else:
            details["messages"].append(
                f"FAIL: {len(keyword_violations)} published post(s) still contain "
                f"target keywords: {keyword_violations}"
            )

        # Dimension 2: Non-matching post 103 must still be published (0.5 pts)
        dim2_score = 0.0
        surviving = SHOULD_SURVIVE & published_ids
        missing = SHOULD_SURVIVE - published_ids

        if surviving == SHOULD_SURVIVE:
            dim2_score = 0.5
            details["messages"].append(
                f"PASS: Non-matching posts preserved: {sorted(surviving)}"
            )
        else:
            details["messages"].append(
                f"FAIL: Non-matching posts incorrectly deleted or missing: "
                f"{sorted(missing)}"
            )

        score = dim1_score + dim2_score
        details["dimension_scores"] = {
            "keyword_posts_deleted": dim1_score,
            "non_keyword_posts_preserved": dim2_score,
        }

    except Exception as e:
        details["messages"].append(f"ERROR: {str(e)}")
        import traceback
        details["messages"].append(traceback.format_exc())

    return score, details


if __name__ == "__main__":
    score, details = main()

    print(f"Score: {score:.1f}/1.0")
    for msg in details.get("messages", []):
        print(f"  {msg}")

    if score >= 0.5:
        sys.exit(0)
    else:
        sys.exit(1)
