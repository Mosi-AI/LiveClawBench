#!/usr/bin/env python3
"""
Verifier for social-cross-publish task (case_id=55).

The agent must read email, check calendar for event date, then publish a post.

Scoring (5 dimensions, 0.2 each):
  - 0.2 for published post with correct topic ("Summer Tech Summit")
  - 0.2 for correct author (mosi_brand)
  - 0.2 for email-specific content (early bird, June 30, save 30%, 50+ speaker)
  - 0.2 for email-specified hashtags (#TechSummit2026 #SummerSummit #TechConference)
  - 0.2 for calendar-derived content (event date "June 15")

Gate: if calendar dimension is 0, total score is capped at 0.4 (below pass threshold).

On untouched seed: no new posts → 0.0
Email-only (no calendar): max 0.8 but gated to 0.4 → fails
Full solution: 1.0
"""

import json
import sys
import urllib.error
import urllib.request

BASE_URL = "http://127.0.0.1:5008"
USERNAME = "mosi_brand"
PASSWORD = "demo123"

LAYER0_POST_IDS = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10}

EMAIL_PHRASES = ["early bird", "june 30", "save 30", "50+ speaker"]
EMAIL_HASHTAGS = ["#techsummit2026", "#summersummit", "#techconference"]

CALENDAR_DATE_PHRASES = ["june 15", "jun 15", "6/15", "06/15"]


def api(path, method="GET", data=None, cookie=None):
    url = f"{BASE_URL}{path}"
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
        new_posts = [p for p in posts if p.get("id") not in LAYER0_POST_IDS]

        if not new_posts:
            messages.append("FAIL: no new posts found")
            print(f"Score: {score}/1.0")
            for msg in messages:
                print(f"  {msg}")
            sys.exit(0 if score >= 0.5 else 1)

        messages.append(f"Found {len(new_posts)} new post(s)")

        target_post = None
        for p in new_posts:
            content = p.get("content", "").lower()
            if "tech summit" in content or "summer tech" in content:
                target_post = p
                break

        if not target_post:
            messages.append(
                "FAIL: no post found mentioning 'tech summit' or 'summer tech'"
            )
            for p in new_posts:
                messages.append(
                    f"  Post id={p.get('id')}: {p.get('content', '')[:80]}..."
                )
            print(f"Score: {score}/1.0")
            for msg in messages:
                print(f"  {msg}")
            sys.exit(0 if score >= 0.5 else 1)

        # Dimension 1: Published with correct topic (0.2)
        dim1_score = 0.0
        if target_post.get("status") == "published":
            dim1_score = 0.2
            messages.append(
                f"PASS: published post with topic match (id={target_post.get('id')})"
            )
        else:
            messages.append(
                f"FAIL: topic match but status='{target_post.get('status')}', expected 'published'"
            )

        # Dimension 2: Correct author (0.2)
        dim2_score = 0.0
        author_username = target_post.get("author_username", "")
        author_id = target_post.get("author_account_id", 0)
        if author_username == "mosi_brand" or author_id == 1:
            dim2_score = 0.2
            messages.append("PASS: post authored by mosi_brand")
        else:
            messages.append(
                f"FAIL: post authored by '{author_username}' (id={author_id})"
            )

        # Dimension 3: Email-specific content (0.2)
        dim3_score = 0.0
        content_lower = target_post.get("content", "").lower()
        found_phrases = [p for p in EMAIL_PHRASES if p in content_lower]
        if len(found_phrases) >= 1:
            dim3_score = 0.2
            messages.append(f"PASS: email-specific content found: {found_phrases}")
        else:
            messages.append(
                f"FAIL: no email-specific content (expected: {EMAIL_PHRASES})"
            )

        # Dimension 4: Email-specified hashtags (0.2)
        dim4_score = 0.0
        tags = target_post.get("tags", [])
        tag_labels = [
            t.get("label_text", "") if isinstance(t, dict) else str(t) for t in tags
        ]
        combined = content_lower + " " + " ".join(tag_labels).lower()

        found_hashtags = [h for h in EMAIL_HASHTAGS if h in combined]
        if len(found_hashtags) >= 2:
            dim4_score = 0.2
            messages.append(f"PASS: email hashtags found: {found_hashtags}")
        elif len(found_hashtags) == 1:
            dim4_score = 0.1
            messages.append(f"PARTIAL: one email hashtag found: {found_hashtags}")
        else:
            messages.append(f"FAIL: no email hashtags (expected: {EMAIL_HASHTAGS})")

        # Dimension 5: Calendar-derived event date (0.2)
        dim5_score = 0.0
        found_date = [d for d in CALENDAR_DATE_PHRASES if d in content_lower]
        if found_date:
            dim5_score = 0.2
            messages.append(f"PASS: calendar-derived event date found: {found_date}")
        else:
            messages.append(
                "FAIL: no calendar-derived event date "
                f"(expected: {CALENDAR_DATE_PHRASES})"
            )

        score = dim1_score + dim2_score + dim3_score + dim4_score + dim5_score

        # Gate: without calendar-derived content, cap below pass threshold
        if dim5_score == 0:
            score = min(score, 0.4)
            messages.append("GATE: calendar dimension missing — score capped at 0.4")

        # Gate: the task requires a PUBLISHED post. A draft or scheduled post
        # with all other content can reach 0.8 via the other four dimensions —
        # cap at 0.4 so non-published solutions cannot pass.
        if dim1_score == 0.0:
            capped = min(score, 0.4)
            if capped < score:
                messages.append(
                    f"GATE: post not published — score capped from "
                    f"{score:.1f} to {capped:.1f}"
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
