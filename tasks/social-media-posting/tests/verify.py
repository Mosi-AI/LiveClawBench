#!/usr/bin/env python3
"""Verify social-media-posting: check alice's post appears in public feed"""

import json
import urllib.error
import urllib.request

SCORE = 0.0
BASE_URL = "http://127.0.0.1:5004"


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


# Step 1: Login as alice
status, body = api(
    "/api/auth/login", "POST", {"username": "alice", "password": "demo123"}
)
if status != 200 or not body.get("success"):
    print(f"Score: {SCORE}/1.0")
    print("FAIL: alice login failed")
    exit(0 if SCORE >= 0.5 else 1)

cookie = f"token={body.get('session_token', '')}"
if not cookie or cookie == "token=":
    # Try to extract from Set-Cookie header
    print("Warning: no session_token in login response")

# Step 2: Create post "Hello from the test!"
status, body = api(
    "/api/posts",
    "POST",
    {"content": "Hello from the test!", "status": "published", "visibility": "public"},
    cookie,
)

if status != 201:
    print(f"Score: {SCORE}/1.0")
    print(f"FAIL: post creation returned {status}")
    exit(0 if SCORE >= 0.5 else 1)

post_id = body.get("post_id")
if not post_id:
    print("FAIL: no post_id in response")
    exit(0 if SCORE >= 0.5 else 1)

# Step 3: Verify post appears in public feed
status, body = api("/api/posts")
if status != 200:
    print(f"Score: {SCORE}/1.0")
    print(f"FAIL: feed retrieval returned {status}")
    exit(0 if SCORE >= 0.5 else 1)

posts = body if isinstance(body, list) else body.get("posts", [])
found = any(p.get("content") == "Hello from the test!" for p in posts)

if found:
    SCORE = 1.0
    print("PASS: alice's post found in public feed")
else:
    print("FAIL: alice's post not found in feed")
    print(f"Available posts: {[p.get('content') for p in posts]}")

print(f"Score: {SCORE}/1.0")
exit(0 if SCORE >= 0.5 else 1)
