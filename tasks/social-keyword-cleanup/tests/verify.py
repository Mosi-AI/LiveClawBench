#!/usr/bin/env python3
"""
Verifier for social-keyword-cleanup task (case_id=51).

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
  - Dimension 1 (0.6): Deletions — 0.2 per target post deleted (posts 9, 101, 102)
  - Dimension 2 (0.4): Preservation — post 103 still published. Only awarded when
    ALL three target posts have been deleted (deleted_count == 3). This prevents a
    partial cleanup (e.g. one target deleted plus untouched post 103) from crossing
    the 0.5 threshold via preservation credit alone.

On untouched seed: dim1 = 0.0 (no deletions), dim2 blocked → total 0.0
Partial deletions (1 or 2 of 3 targets) cap at 0.4 (below threshold) because
preservation credit requires complete deletion of all keyword-matching posts.
"""

import json
import sys
import urllib.error
import urllib.request

SOCIAL_URL = "http://127.0.0.1:5008"

SOCIAL_USERNAME = "mosi_brand"
SOCIAL_PASSWORD = "demo123"


MOSI_BRAND_ACCOUNT_ID = 1
SHOULD_DELETE = {9, 101, 102}
SHOULD_SURVIVE = {103}


def api(
    method: str,
    path: str,
    data: dict | None = None,
    cookie: str | None = None,
) -> tuple[int, dict]:
    url = f"{SOCIAL_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if cookie:
        headers["Cookie"] = cookie

    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        error_body = e.read()
        return e.code, json.loads(error_body) if error_body else {}
    except Exception as e:
        return 0, {"error": str(e)}


def main() -> tuple[float, dict]:
    score = 0.0
    details: dict = {"dimension_scores": {}, "messages": []}

    try:
        status, login_body = api(
            "POST",
            "/api/auth/login",
            {"username": SOCIAL_USERNAME, "password": SOCIAL_PASSWORD},
        )
        if status != 200 or not login_body.get("success"):
            raise Exception(f"Login failed: status={status}, body={login_body}")

        cookie = f"token={login_body.get('session_token', '')}"
        details["messages"].append(f"Logged in as {SOCIAL_USERNAME}")

        posts_status, posts_resp = api(
            "GET",
            f"/api/posts?author_id={MOSI_BRAND_ACCOUNT_ID}&include_deleted=true&limit=100",
            cookie=cookie,
        )
        if posts_status != 200:
            raise Exception(f"Feed retrieval returned {posts_status}")
        all_posts = posts_resp.get("posts", [])

        # Verify actual deletion (status='deleted'), not just absence from feed
        deleted_ids = {p["id"] for p in all_posts if p.get("status") == "deleted"}
        published_ids = {p["id"] for p in all_posts if p.get("status") == "published"}

        details["messages"].append(
            f"Published posts by mosi_brand: {sorted(published_ids)}"
        )
        details["messages"].append(
            f"Deleted posts by mosi_brand: {sorted(deleted_ids)}"
        )

        # Dimension 1: Target posts deleted (0.6 pts — 0.2 per post)
        confirmed_deleted = SHOULD_DELETE & deleted_ids
        still_visible = SHOULD_DELETE & published_ids
        hidden_not_deleted = SHOULD_DELETE - deleted_ids - still_visible
        deleted_count = len(confirmed_deleted)
        dim1_score = deleted_count * 0.2

        if deleted_count == len(SHOULD_DELETE):
            details["messages"].append("PASS: All keyword-matching posts deleted")
        elif deleted_count > 0:
            details["messages"].append(
                f"PARTIAL: {deleted_count}/{len(SHOULD_DELETE)} target posts deleted, "
                f"still published: {sorted(still_visible)}, "
                f"hidden but not deleted: {sorted(hidden_not_deleted)}"
            )
        else:
            details["messages"].append(
                f"FAIL: No target posts deleted (status='deleted'), "
                f"still published: {sorted(still_visible)}, "
                f"hidden but not deleted: {sorted(hidden_not_deleted)}"
            )

        # Dimension 2: Non-matching post 103 preserved (0.4 pts).
        # Gated on COMPLETE deletion of all keyword-target posts (deleted_count == 3).
        # A partial deletion (e.g. 1 of 3) plus an untouched post 103 must not be
        # able to cross the 0.5 success threshold via preservation credit alone.
        dim2_score = 0.0
        if deleted_count == len(SHOULD_DELETE):
            surviving = SHOULD_SURVIVE & published_ids
            missing = SHOULD_SURVIVE - published_ids
            if surviving == SHOULD_SURVIVE:
                dim2_score = 0.4
                details["messages"].append(
                    f"PASS: Non-matching posts preserved: {sorted(surviving)}"
                )
            else:
                details["messages"].append(
                    f"FAIL: Non-matching posts incorrectly deleted: {sorted(missing)}"
                )
        else:
            details["messages"].append(
                "SKIP: Preservation check blocked — partial or no deletions "
                f"({deleted_count}/{len(SHOULD_DELETE)} targets removed); "
                "preservation credit requires complete cleanup"
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
