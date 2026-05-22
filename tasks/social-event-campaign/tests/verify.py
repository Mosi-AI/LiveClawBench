#!/usr/bin/env python3
"""
Verifier for social-event-campaign task (case_id=52).

The agent must:
  1. Read an email with instructions to publish a draft event campaign post
  2. Log into the social media platform as mosi_brand
  3. Publish the draft post (post 101, status: draft -> published)
  4. Send a confirmation email to events@mosi.inc with subject "Event Campaign Published"

Scoring:
  - Dimension 1 (0.5): Post 101 is now "published" (was "draft")
  - Dimension 2 (0.5): Confirmation email sent to events@mosi.inc with correct subject

Completion gate: when either dimension is 0.0 (post-only or email-only solutions),
the final score is capped at 0.4 — below the 0.5 success threshold. The task
explicitly requires BOTH the publish action AND the confirmation email; a
one-service partial solution must not pass.
"""

import json
import sqlite3
import sys
import urllib.error
import urllib.request

SOCIAL_URL = "http://127.0.0.1:5008"
EMAIL_DB_PATH = "/var/lib/mock-data/email/email.db"

SOCIAL_USERNAME = "mosi_brand"
SOCIAL_PASSWORD = "demo123"

TARGET_POST_ID = 101
TARGET_EMAIL_RECIPIENT = "events@mosi.inc"
TARGET_SUBJECT_PATTERN = "Event Campaign Published"


def api(
    method: str, path: str, data: dict | None = None, cookie: str | None = None
) -> tuple[int, dict]:
    """Call the social media API and return (status_code, response_body)."""
    url = f"{SOCIAL_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if cookie:
        headers["Cookie"] = cookie

    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        try:
            parsed = json.loads(error_body)
        except Exception:
            parsed = {"error": error_body}
        return e.code, parsed
    except Exception as e:
        return 0, {"error": str(e)}


def check_email_sent() -> bool:
    """Check if a confirmation email was sent to events@mosi.inc."""
    try:
        email_db = sqlite3.connect(EMAIL_DB_PATH)
        cursor = email_db.execute(
            "SELECT COUNT(*) FROM emails WHERE recipient_email = ? AND subject LIKE ? AND folder = 'sent'",
            (TARGET_EMAIL_RECIPIENT, f"%{TARGET_SUBJECT_PATTERN}%"),
        )
        count = cursor.fetchone()[0]
        email_db.close()
        return count > 0
    except Exception as e:
        print(f"  WARNING: Email DB check failed: {e}")
        return False


def main() -> tuple[float, dict]:
    score = 0.0
    details: dict = {"dimension_scores": {}, "messages": []}

    # --- Dimension 1: Post 101 must be published (0.5 pts) ---
    dim1_score = 0.0
    try:
        # Login as mosi_brand
        status, body = api(
            "POST",
            "/api/auth/login",
            {"username": SOCIAL_USERNAME, "password": SOCIAL_PASSWORD},
        )
        if status != 200 or not body.get("success"):
            raise Exception(f"Login failed: status={status}, body={body}")

        token = body.get("session_token", "")
        cookie = f"token={token}"
        details["messages"].append(f"Logged in as {SOCIAL_USERNAME}")

        # Get post 101
        status, post = api("GET", f"/api/posts/{TARGET_POST_ID}", cookie=cookie)
        if status != 200:
            raise Exception(f"Post {TARGET_POST_ID} not found: status={status}")

        post_status = post.get("status", "")
        details["messages"].append(f"Post {TARGET_POST_ID} status: {post_status}")

        if post_status == "published":
            dim1_score = 0.5
            details["messages"].append("PASS: Post 101 is published")
        else:
            details["messages"].append(
                f"FAIL: Post 101 status is '{post_status}', expected 'published'"
            )

    except Exception as e:
        details["messages"].append(f"ERROR (social check): {e}")

    # --- Dimension 2: Confirmation email sent (0.5 pts) ---
    dim2_score = 0.0
    try:
        if check_email_sent():
            dim2_score = 0.5
            details["messages"].append(
                f"PASS: Confirmation email sent to {TARGET_EMAIL_RECIPIENT} "
                f"with subject containing '{TARGET_SUBJECT_PATTERN}'"
            )
        else:
            details["messages"].append(
                f"FAIL: No email found to {TARGET_EMAIL_RECIPIENT} "
                f"with subject containing '{TARGET_SUBJECT_PATTERN}'"
            )
    except Exception as e:
        details["messages"].append(f"ERROR (email check): {e}")

    score = dim1_score + dim2_score
    details["dimension_scores"] = {
        "post_published": dim1_score,
        "email_sent": dim2_score,
    }

    # Completion gate: a one-service partial state (post-only or email-only) must
    # not reach the 0.5 success threshold. The task requires BOTH artifacts, so
    # cap the score at 0.4 whenever either dimension is missing.
    if dim1_score == 0.0 or dim2_score == 0.0:
        capped = min(score, 0.4)
        if capped < score:
            details["messages"].append(
                f"GATE: Required workflow artifact missing — score capped from "
                f"{score:.1f} to {capped:.1f} (need BOTH post publish AND "
                f"confirmation email)"
            )
        score = capped

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
