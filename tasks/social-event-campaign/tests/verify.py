#!/usr/bin/env python3
"""
Verifier for social-event-campaign task (case_id=52).

The agent must:
  1. Read an email with instructions to publish a draft event campaign post
  2. Log into the social media platform as mosi_brand
  3. Publish the draft post (post 101, status: draft -> published)
  4. Send a confirmation email to events@mosi.inc with subject "Event Campaign Published"

Scoring:
  - Dimension 1 (0.3): Post 101 is now "published" (was "draft")
  - Dimension 2 (0.7): Confirmation email sent to events@mosi.inc with correct subject

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


def token_f1(expected: str, actual: str) -> float:
    """Compute token-level F1 between two strings."""
    expected_tokens = set(expected.lower().split())
    actual_tokens = set(actual.lower().split())
    if not expected_tokens or not actual_tokens:
        return 0.0
    matched = expected_tokens & actual_tokens
    precision = len(matched) / len(actual_tokens)
    recall = len(matched) / len(expected_tokens)
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


EMAIL_DB_PATH = "/var/lib/mock-data/email/email.db"

SOCIAL_USERNAME = "mosi_brand"
SOCIAL_PASSWORD = "demo123"

TARGET_POST_ID = 101
TARGET_EMAIL_RECIPIENT = "events@mosi.inc"
TARGET_SUBJECT = "Event Campaign Published"


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
        except json.JSONDecodeError:
            parsed = {"error": error_body}
        return e.code, parsed
    except (urllib.error.URLError, ConnectionError, TimeoutError, OSError) as e:
        return 0, {"error": f"{type(e).__name__}: {e}"}


def check_email_sent() -> tuple[bool, float]:
    """Check if a confirmation email was sent to events@mosi.inc.

    Returns (email_exists, subject_f1).
    email_exists: whether any sent email to the recipient was found.
    subject_f1: F1 score of the best-matching subject against TARGET_SUBJECT.
    """
    try:
        email_db = sqlite3.connect(EMAIL_DB_PATH)
        row = email_db.execute(
            "SELECT subject FROM emails WHERE folder = 'sent' AND recipient_email = ? ORDER BY id DESC LIMIT 1",
            (TARGET_EMAIL_RECIPIENT,),
        ).fetchone()
        email_db.close()
        if row is None:
            return False, 0.0
        subject = row[0] or ""
        f1 = token_f1(TARGET_SUBJECT, subject)
        return True, f1
    except sqlite3.Error as e:
        print(f"  WARNING: Email DB check failed: {type(e).__name__}: {e}")
        return False, 0.0


def main() -> tuple[float, dict]:
    score = 0.0
    details: dict = {"dimension_scores": {}, "messages": []}

    # --- Dimension 1: Post 101 must be published (0.3 pts) ---
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
            dim1_score = 0.3
            details["messages"].append("PASS: Post 101 is published")
        else:
            details["messages"].append(
                f"FAIL: Post 101 status is '{post_status}', expected 'published'"
            )

    except Exception as e:
        details["messages"].append(f"ERROR (social check): {type(e).__name__}: {e}")

    # --- Dimension 2: Confirmation email sent (0.7 pts) ---
    dim2_score = 0.0
    try:
        email_exists, subject_f1 = check_email_sent()
        if email_exists:
            dim2_score = 0.7 * subject_f1
            if subject_f1 >= 0.5:
                details["messages"].append(
                    f"PASS: Confirmation email sent to {TARGET_EMAIL_RECIPIENT} "
                    f"with subject F1={subject_f1:.2f} against '{TARGET_SUBJECT}'"
                )
            else:
                details["messages"].append(
                    f"PARTIAL: Confirmation email sent to {TARGET_EMAIL_RECIPIENT} "
                    f"but subject F1={subject_f1:.2f} (expected '{TARGET_SUBJECT}')"
                )
        else:
            details["messages"].append(
                f"FAIL: No sent email found to {TARGET_EMAIL_RECIPIENT}"
            )
    except sqlite3.Error as e:
        details["messages"].append(f"ERROR (email check): {type(e).__name__}: {e}")

    score = dim1_score + dim2_score
    details["dimension_scores"] = {
        "post_published": dim1_score,
        "email_sent": dim2_score,
    }

    # Completion gate: a one-service partial state (post-only or no-email) must
    # not reach the 0.5 success threshold. The task requires BOTH artifacts, so
    # cap the score at 0.4 when the post is not published OR no email was sent.
    # If an email was sent but the subject F1 is low, that is a quality issue,
    # not a missing artifact, so the gate does not apply.
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
