#!/usr/bin/env python3
"""Verify social-media-posting: check alice's post appears in public feed"""

import json
import sys
import urllib.error
import urllib.request

BASE_URL = "http://127.0.0.1:5008"


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


def main() -> float:
    # Step 1: Login as alice
    status, body = api(
        "/api/auth/login", "POST", {"username": "alice", "password": "demo123"}
    )
    if status != 200 or not body.get("success"):
        print("Score: 0.0/1.0")
        print("FAIL: alice login failed")
        return 0.0

    session_token = body.get("session_token", "")
    if not session_token:
        print("Warning: no session_token in login response")

    # Step 2: Verify post appears in public feed (agent should have created it)
    status, body = api("/api/posts")
    if status != 200:
        print("Score: 0.0/1.0")
        print(f"FAIL: feed retrieval returned {status}")
        return 0.0

    posts = body if isinstance(body, list) else body.get("posts", [])
    found = any(p.get("content") == "Hello from the test!" for p in posts)

    if found:
        print("PASS: alice's post found in public feed")
        return 1.0

    print("FAIL: alice's post not found in feed")
    print(f"Available posts: {[p.get('content') for p in posts]}")
    return 0.0


if __name__ == "__main__":
    score = main()
    print(f"Score: {score}/1.0")
    sys.exit(0 if score >= 0.5 else 1)
