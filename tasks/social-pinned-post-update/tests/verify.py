#!/usr/bin/env python3
"""
Verifier for social-pinned-post-update task (case_id=56).

The agent must:
  1. Read email with pinned post update instructions
  2. Find verification code SM-Q2-7842 from the calendar event source_ref
  3. Unpin post 1 (launch announcement), pin post 9 (10K followers giveaway)
  4. Send a confirmation email to social-team@mosi.inc that contains the
     verification code AND confirms the pin change for both the old launch
     announcement post (unpinned) and the new 10K followers giveaway post (pinned)

Scoring:
  - 0.2 for post_id=1 unpinned
  - 0.2 for post_id=9 pinned
  - 0.6 for the confirmation email — binary check, requires ALL of:
      * folder = 'sent'
      * lower(recipient_email) = 'social-team@mosi.inc'
      * subject_or_body contains the verification code 'SM-Q2-7842'
      * subject_or_body contains a new-pin cue: '10k' OR 'giveaway'
        (case-insensitive)
      * subject_or_body contains an old-unpin cue: BOTH 'launch' AND 'unpinned'
        (case-insensitive)
    Any missing condition → dim3 = 0.0.

On untouched seed: 0.0
After pin swap only: 0.4 (fails — must also send confirmation email)
After pin swap + email to wrong recipient: 0.4 (fails — recipient must match)
After pin swap + email to correct recipient missing the code: 0.4 (fails — code required)
After pin swap + email with code only (no pin-change cues): 0.4 (fails — must
  confirm both the new pin and the unpin per instruction)
After pin swap + email with code + only new-pin cue (no unpin confirmation): 0.4
After pin swap + email with code + only unpin confirmation (no new-pin cue): 0.4
After full solution (pin swap + code + new-pin cue + unpin cue): 1.0
"""

import json
import sqlite3
import sys
import urllib.error
import urllib.request

SOCIAL_URL = "http://127.0.0.1:5004"
EMAIL_DB = "/var/lib/mock-data/email/email.db"
USERNAME = "mosi_brand"
PASSWORD = "demo123"

VERIFICATION_CODE = "SM-Q2-7842"
CONFIRMATION_RECIPIENT = "social-team@mosi.inc"


def api(path, method="GET", data=None, cookie=None):
    url = f"{SOCIAL_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if cookie:
        headers["Cookie"] = cookie

    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        resp_body = e.read()
        return e.code, json.loads(resp_body) if resp_body else {}
    except Exception as e:
        return 0, {"error": str(e)}


def main():
    score = 0.0
    messages = []

    try:
        status, body = api(
            "/api/auth/login", "POST", {"username": USERNAME, "password": PASSWORD}
        )
        if status != 200 or not body.get("success"):
            messages.append(f"FAIL: mosi_brand login failed (status={status})")
            print(f"Score: {score}/1.0")
            for msg in messages:
                print(f"  {msg}")
            sys.exit(1)

        cookie = f"token={body.get('session_token', '')}"
        if not cookie or cookie == "token=":
            messages.append("FAIL: no session_token in login response")
            print(f"Score: {score}/1.0")
            for msg in messages:
                print(f"  {msg}")
            sys.exit(1)

        messages.append(f"Logged in as {USERNAME}")

        status, body = api("/api/posts?author_id=1&limit=100", cookie=cookie)
        if status != 200:
            messages.append(f"FAIL: feed retrieval returned {status}")
            print(f"Score: {score}/1.0")
            for msg in messages:
                print(f"  {msg}")
            sys.exit(0 if score >= 0.5 else 1)

        posts = body if isinstance(body, list) else body.get("posts", [])

        old_post = None
        new_post = None
        for p in posts:
            if p.get("id") == 1:
                old_post = p
            elif p.get("id") == 9:
                new_post = p

        # Dimension 1: post_id=1 unpinned (0.2)
        dim1_score = 0.0
        if old_post and old_post.get("is_pinned", 0) == 0:
            dim1_score = 0.2
            messages.append("PASS: post_id=1 unpinned")
        else:
            messages.append("FAIL: post_id=1 still pinned or not found")

        # Dimension 2: post_id=9 pinned (0.2)
        dim2_score = 0.0
        if new_post and new_post.get("is_pinned", 0) == 1:
            dim2_score = 0.2
            messages.append("PASS: post_id=9 pinned")
        else:
            messages.append("FAIL: post_id=9 not pinned or not found")

        # Dimension 3: Confirmation email sent to social-team@mosi.inc (0.6)
        # Binary check — must match ALL of: folder='sent', recipient, code,
        # new-pin cue ('10k' or 'giveaway'), old-unpin cue ('launch' AND 'unpinned').
        dim3_score = 0.0
        try:
            email_db = sqlite3.connect(EMAIL_DB)
            rows = email_db.execute(
                "SELECT id, subject, body, recipient_email FROM emails "
                "WHERE folder = 'sent' AND lower(recipient_email) = lower(?) "
                "ORDER BY created_at DESC LIMIT 50",
                (CONFIRMATION_RECIPIENT,),
            ).fetchall()
            email_db.close()

            if not rows:
                messages.append(
                    f"FAIL: no sent email to recipient '{CONFIRMATION_RECIPIENT}' "
                    "(folder='sent' required)"
                )
            else:
                found_email = None
                fail_reasons: list[str] = []
                for r in rows:
                    subject = r[1] or ""
                    body = r[2] or ""
                    combined = f"{subject}\n{body}"
                    combined_lower = combined.lower()

                    has_code = VERIFICATION_CODE in combined
                    has_new_pin_cue = (
                        "10k" in combined_lower or "giveaway" in combined_lower
                    )
                    has_old_unpin_cue = (
                        "launch" in combined_lower and "unpinned" in combined_lower
                    )

                    if has_code and has_new_pin_cue and has_old_unpin_cue:
                        found_email = r
                        break

                    missing = []
                    if not has_code:
                        missing.append(f"code '{VERIFICATION_CODE}'")
                    if not has_new_pin_cue:
                        missing.append("new-pin cue ('10k' or 'giveaway')")
                    if not has_old_unpin_cue:
                        missing.append("old-unpin cue ('launch' AND 'unpinned')")
                    fail_reasons.append(
                        f"email_id={r[0]} missing: {', '.join(missing)}"
                    )

                if found_email:
                    dim3_score = 0.6
                    messages.append(
                        f"PASS: sent email to '{CONFIRMATION_RECIPIENT}' contains "
                        f"code '{VERIFICATION_CODE}', a new-pin cue, and an "
                        f"old-unpin cue (email_id={found_email[0]})"
                    )
                else:
                    messages.append(
                        f"FAIL: {len(rows)} sent email(s) to "
                        f"'{CONFIRMATION_RECIPIENT}' found but none satisfy all "
                        "of (code, new-pin cue, old-unpin cue)"
                    )
                    for fr in fail_reasons[:5]:
                        messages.append(f"  - {fr}")
        except Exception as e:
            messages.append(f"FAIL: cannot check email DB: {e}")

        score = dim1_score + dim2_score + dim3_score

        # Completion gate: the task requires BOTH the pin swap AND the
        # confirmation email. An email-only solution (dim3=0.6) reaches the
        # success threshold without performing the pin swap. Cap at 0.4 when
        # either pin-state dimension is missing.
        if dim1_score == 0.0 or dim2_score == 0.0:
            capped = min(score, 0.4)
            if capped < score:
                messages.append(
                    f"GATE: pin swap incomplete — score capped from "
                    f"{score:.1f} to {capped:.1f} "
                    f"(need both post 1 unpinned AND post 9 pinned)"
                )
            score = capped

    except Exception as e:
        messages.append(f"ERROR: {str(e)}")
        import traceback

        messages.append(traceback.format_exc())

    print(f"Score: {score:.1f}/1.0")
    for msg in messages:
        print(f"  {msg}")

    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
