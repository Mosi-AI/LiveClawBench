#!/usr/bin/env python3
"""
Verifier for social-cross-publish task (case_id=44).

The agent must read an email with promotional content, check the calendar for
context, then create and publish a social media post.

Layer 0 seeded state (from db.ts seedData):
  - mosi_brand account (id=1, password: demo123)
  - 10 posts with ids 1-10 (none about "Summer Tech Summit")

Expected agent actions:
  1. Read email about "Cross-Publish Content to Social Media"
  2. Check calendar for format hints
  3. Login to social media as mosi_brand
  4. Create and publish a new post about "Summer Tech Summit 2026"

Scoring:
  - 0.4 for published post with correct topic ("Summer Tech Summit" or "Tech Summit 2026")
  - 0.3 for including relevant hashtags (#TechSummit2026)
  - 0.3 for correct author (mosi_brand)
"""

import json
import sys
import urllib.error
import urllib.request

SCORE = 0.0
BASE_URL = "http://127.0.0.1:5004"
USERNAME = "mosi_brand"
PASSWORD = "demo123"

# Layer 0 post IDs (from db.ts seedData)
LAYER0_POST_IDS = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10}


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
        # Step 1: Login as mosi_brand
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

        # Step 2: Get all posts (including own drafts to find new post)
        status, body = api("/api/posts", cookie=cookie)
        if status != 200:
            messages.append(f"FAIL: feed retrieval returned {status}")
            print(f"Score: {score}/1.0")
            for msg in messages:
                print(f"  {msg}")
            sys.exit(0 if score >= 0.5 else 1)

        posts = body if isinstance(body, list) else body.get("posts", [])

        # Find new posts (not in Layer 0 seed)
        new_posts = [p for p in posts if p.get("id") not in LAYER0_POST_IDS]

        if not new_posts:
            # Also check author's own posts including drafts
            auth_data = body.get("account", {}) if isinstance(body, dict) else {}
            # Try getting all mosi_brand posts including drafts
            account = body.get("account") if isinstance(body, dict) else None
            author_id = None
            if account and isinstance(account, dict):
                author_id = account.get("id")
            else:
                # Get author_id from login response
                author_id = 1  # mosi_brand is always id=1

            status2, body2 = api(
                f"/api/posts?status=draft&author_id={author_id}", cookie=cookie
            )
            if status2 == 200:
                draft_posts = body2.get("posts", []) if isinstance(body2, dict) else []
                new_posts.extend(
                    p for p in draft_posts if p.get("id") not in LAYER0_POST_IDS
                )

            status3, body3 = api(
                f"/api/posts?status=scheduled&author_id={author_id}", cookie=cookie
            )
            if status3 == 200:
                scheduled_posts = body3.get("posts", []) if isinstance(body3, dict) else []
                new_posts.extend(
                    p for p in scheduled_posts if p.get("id") not in LAYER0_POST_IDS
                )

        if not new_posts:
            messages.append("FAIL: no new posts found")
            print(f"Score: {score}/1.0")
            for msg in messages:
                print(f"  {msg}")
            sys.exit(0 if score >= 0.5 else 1)

        messages.append(f"Found {len(new_posts)} new post(s)")

        # Dimension 1: Published post with correct topic (0.4)
        dim1_score = 0.0
        target_post = None
        for p in new_posts:
            content = p.get("content", "").lower()
            if "tech summit" in content or "summer tech" in content:
                target_post = p
                if p.get("status") == "published":
                    dim1_score = 0.4
                    messages.append(
                        f"PASS: published post found with topic match (id={p.get('id')})"
                    )
                else:
                    dim1_score = 0.2
                    messages.append(
                        f"PARTIAL: post found with topic match but status='{p.get('status')}' (id={p.get('id')})"
                    )
                break

        if dim1_score == 0.0:
            messages.append(
                "FAIL: no post found mentioning 'tech summit' or 'summer tech'"
            )
            # Show what posts were found for debugging
            for p in new_posts:
                messages.append(f"  Post id={p.get('id')}: {p.get('content', '')[:80]}...")

        # Dimension 2: Includes relevant hashtags (0.3)
        dim2_score = 0.0
        if target_post:
            content = target_post.get("content", "")
            tags = target_post.get("tags", [])
            tag_labels = [t.get("label_text", "") if isinstance(t, dict) else str(t) for t in tags]
            tag_text = " ".join(tag_labels).lower()
            combined = content.lower() + " " + tag_text

            if "#techsummit2026" in combined:
                dim2_score = 0.3
                messages.append("PASS: post includes #TechSummit2026 hashtag")
            elif "techsummit" in combined or "tech summit" in combined:
                dim2_score = 0.15
                messages.append(
                    "PARTIAL: post mentions tech summit but missing exact #TechSummit2026 hashtag"
                )
            else:
                messages.append("FAIL: post does not include relevant hashtags")

            # Also check for additional hashtags from email content
            extra_hashtags = ["#summersummit", "#techconference"]
            found_extra = [h for h in extra_hashtags if h in combined]
            if found_extra:
                messages.append(f"  Bonus hashtags found: {found_extra}")
        else:
            messages.append("FAIL: no target post to check hashtags")

        # Dimension 3: Correct author is mosi_brand (0.3)
        dim3_score = 0.0
        if target_post:
            author_username = target_post.get("author_username", "")
            author_id = target_post.get("author_account_id", 0)
            if author_username == "mosi_brand" or author_id == 1:
                dim3_score = 0.3
                messages.append("PASS: post authored by mosi_brand")
            else:
                messages.append(
                    f"FAIL: post authored by '{author_username}' (id={author_id}), expected mosi_brand"
                )
        else:
            messages.append("FAIL: no target post to check author")

        score = dim1_score + dim2_score + dim3_score

    except Exception as e:
        messages.append(f"ERROR: {str(e)}")
        import traceback

        messages.append(traceback.format_exc())

    print(f"Score: {score}/1.0")
    for msg in messages:
        print(f"  {msg}")

    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
