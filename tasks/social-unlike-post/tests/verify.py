#!/usr/bin/env python3
"""
Verifier for social-unlike-post task.
Scores: (1) liked=false after unlike -> 0.5, (2) like_count decreased by 1 -> 0.5

Post-agent verification: the agent has already completed its work.
We do ONE authenticated feed read and check seeded post state.

Seeded invariants:
- post_id=1 has alice's (account_id=2) like in post_like table
- Baseline: liked=true, like_count >= 1 (alice's like included)
- After unlike: liked=false, like_count = baseline - 1

Since alice's like is the ONLY like on post_id=1 (seeded baseline count=1),
after unlike: liked=false, like_count must be 0.
"""

import json
import sys
import urllib.error
import urllib.request

BASE_URL = "http://127.0.0.1:5004"
USERNAME = "alice"
PASSWORD = "demo123"

# Alice's seeded liked post (post_id=1, account_id=2)
# After unlike: liked=false, like_count=0 (since alice's like was the only one)
SEEDED_POST_ID = 1
# Baseline like_count for post_id=1 when alice's like exists
BASELINE_LIKE_COUNT = 1


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
        body = e.read()
        return e.code, json.loads(body) if body else {}
    except Exception as e:
        return 0, {"error": str(e)}


def main():
    score = 0.0
    messages = []

    try:
        # Step 1: Login as alice
        status, body = api(
            "/api/auth/login", "POST", {"username": USERNAME, "password": PASSWORD}
        )
        if status != 200 or not body.get("success"):
            messages.append(f"FAIL: alice login failed (status={status})")
            print(f"Score: {score}/1.0")
            for msg in messages:
                print(f"  {msg}")
            sys.exit(0 if score >= 0.5 else 1)

        cookie = f"token={body.get('session_token', '')}"
        if not cookie or cookie == "token=":
            messages.append("FAIL: no session_token in login response")
            print(f"Score: {score}/1.0")
            for msg in messages:
                print(f"  {msg}")
            sys.exit(1)

        messages.append(f"Logged in as {USERNAME}")

        # Step 2: Get POST-agent state with auth cookie
        status, body = api("/api/posts", cookie=cookie)
        if status != 200:
            messages.append(f"FAIL: feed retrieval returned {status}")
            print(f"Score: {score}/1.0")
            for msg in messages:
                print(f"  {msg}")
            sys.exit(0 if score >= 0.5 else 1)

        posts = body if isinstance(body, list) else body.get("posts", [])

        # Find seeded post
        seeded_post = None
        for p in posts:
            if p.get("id") == SEEDED_POST_ID:
                seeded_post = p
                break

        if seeded_post is None:
            messages.append(f"FAIL: seeded post {SEEDED_POST_ID} not found in feed")
            print(f"Score: {score}/1.0")
            for msg in messages:
                print(f"  {msg}")
            sys.exit(0 if score >= 0.5 else 1)

        liked = seeded_post.get("liked", False)
        like_count = seeded_post.get("like_count", 0)

        messages.append(
            f"Post-agent state: id={SEEDED_POST_ID}, liked={liked}, like_count={like_count}"
        )

        # Dimension 1: liked should be false (agent unliked the post)
        dim1_score = 0.0
        if not liked:
            dim1_score = 0.5
            messages.append("PASS: liked=false (post unliked by agent)")
        else:
            messages.append("FAIL: liked still true (agent did not unlike)")

        # Dimension 2: like_count should be 0 (baseline was 1, alice's like removed)
        dim2_score = 0.0
        if like_count == 0:
            dim2_score = 0.5
            messages.append(
                f"PASS: like_count=0 (baseline was {BASELINE_LIKE_COUNT}, decremented by 1)"
            )
        else:
            messages.append(
                f"FAIL: like_count={like_count} (expected 0, baseline was {BASELINE_LIKE_COUNT})"
            )

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
