#!/usr/bin/env python3
"""
Verifier for social-pinned-post-update task.
Scores: (1) post_id=1 is_pinned=0 -> 0.5, (2) post_id=9 is_pinned=1 -> 0.5

Layer 0 seeded state:
- post_id=1 (mosi_brand, "Welcome to Mosi Social! ... #MosiLaunch"): is_pinned=1
- post_id=9 (mosi_brand, "Thank you all for 10K followers! ... #Giveaway #Milestone"): is_pinned=0

Layer 1 seed adds post_id=101 as a distractor (A2 factor).

After agent action:
- post_id=1 should have is_pinned=0 (unpinned)
- post_id=9 should have is_pinned=1 (new pinned post)
"""

import json
import sys
import urllib.error
import urllib.request

BASE_URL = "http://127.0.0.1:5004"
USERNAME = "mosi_brand"
PASSWORD = "demo123"

OLD_PINNED_POST_ID = 1
NEW_PINNED_POST_ID = 9


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

        # Step 2: Get post-agent state
        status, body = api("/api/posts", cookie=cookie)
        if status != 200:
            messages.append(f"FAIL: feed retrieval returned {status}")
            print(f"Score: {score}/1.0")
            for msg in messages:
                print(f"  {msg}")
            sys.exit(0 if score >= 0.5 else 1)

        posts = body if isinstance(body, list) else body.get("posts", [])

        # Find the two target posts
        old_post = None
        new_post = None
        for p in posts:
            if p.get("id") == OLD_PINNED_POST_ID:
                old_post = p
            elif p.get("id") == NEW_PINNED_POST_ID:
                new_post = p

        # Dimension 1: old pinned post (post_id=1) should be unpinned
        dim1_score = 0.0
        if old_post is None:
            messages.append(
                f"FAIL: old pinned post {OLD_PINNED_POST_ID} not found in feed"
            )
        else:
            old_pinned = old_post.get("is_pinned", 0)
            messages.append(
                f"Post-agent state: id={OLD_PINNED_POST_ID}, is_pinned={old_pinned}"
            )
            if old_pinned == 0:
                dim1_score = 0.5
                messages.append("PASS: post_id=1 unpinned (is_pinned=0)")
            else:
                messages.append("FAIL: post_id=1 still pinned (is_pinned=1)")

        # Dimension 2: new pinned post (post_id=9) should be pinned
        dim2_score = 0.0
        if new_post is None:
            messages.append(
                f"FAIL: target post {NEW_PINNED_POST_ID} not found in feed"
            )
        else:
            new_pinned = new_post.get("is_pinned", 0)
            messages.append(
                f"Post-agent state: id={NEW_PINNED_POST_ID}, is_pinned={new_pinned}"
            )
            if new_pinned == 1:
                dim2_score = 0.5
                messages.append("PASS: post_id=9 pinned (is_pinned=1)")
            else:
                messages.append("FAIL: post_id=9 not pinned (is_pinned=0)")

        score = dim1_score + dim2_score

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
