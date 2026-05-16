#!/usr/bin/env python3
"""Verify social-comment-moderation: check that violating comments were removed
and a reply was posted to the legitimate question.

Scoring (total 1.0):
  - Comment 101 (scam) deleted/hidden:       0.2
  - Comment 103 (fake news) deleted/hidden:   0.2
  - Comment 104 (spam) deleted/hidden:        0.2
  - Comment 102 still visible:                0.2
  - Reply posted to comment 102:              0.2

Completion gate: the reply to comment 102 is the required workflow artifact for
this task. When no reply is found, the final score is capped at 0.4 — below the
0.5 success threshold. Moderation-only solutions (hiding the three violating
comments without replying) cannot pass.
"""

import json
import sqlite3
import sys
import urllib.error
import urllib.request

SCORE = 0.0
SOCIAL_DB = "/opt/mock/data/social/social.db"
SOCIAL_API = "http://127.0.0.1:5004"


def query_db(sql, params=()):
    conn = sqlite3.connect(SOCIAL_DB)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def api(path, method="GET", data=None, cookie=None):
    url = f"{SOCIAL_API}{path}"
    headers = {"Content-Type": "application/json"}
    if cookie:
        headers["Cookie"] = cookie
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_text = e.read()
        return e.code, json.loads(body_text) if body_text else {}
    except Exception as e:
        return 0, {"error": str(e)}


# --- Check 1-3: Violating comments should be deleted or hidden ---

violating_comments = [
    (101, "scam"),
    (103, "fake news"),
    (104, "spam"),
]

for cid, keyword in violating_comments:
    rows = query_db("SELECT status FROM comment WHERE id = ?", (cid,))
    if not rows:
        SCORE += 0.2
        print(f"PASS: Comment {cid} ({keyword}) removed from database")
    else:
        status = rows[0]["status"]
        if status != "visible":
            SCORE += 0.2
            print(f"PASS: Comment {cid} ({keyword}) status is '{status}'")
        else:
            print(f"FAIL: Comment {cid} ({keyword}) is still visible")

# --- Check 4: Legitimate comment 102 should still be visible ---

rows = query_db("SELECT status FROM comment WHERE id = 102")
if rows and rows[0]["status"] == "visible":
    SCORE += 0.2
    print("PASS: Comment 102 (legitimate question) is still visible")
else:
    status = rows[0]["status"] if rows else "missing"
    print(f"FAIL: Comment 102 status is '{status}', expected 'visible'")

# --- Check 5: A reply was posted to comment 102 from mosi_brand ---

reply_found = False

# Find replies to comment 102 (parent_comment_id = 102)
replies = query_db(
    "SELECT c.*, a.username FROM comment c "
    "LEFT JOIN account a ON c.author_account_id = a.id "
    "WHERE c.parent_comment_id = 102 AND c.status = 'visible' AND a.username = 'mosi_brand'"
)

if replies:
    reply_found = True
    SCORE += 0.2
    reply_info = ", ".join(
        f"'{r['body'][:50]}' by {r.get('username', 'unknown')}" for r in replies
    )
    print(f"PASS: Reply found to comment 102: {reply_info}")
else:
    # Also check via API (login as mosi_brand and fetch comments)
    status, body = api(
        "/api/auth/login", "POST", {"username": "mosi_brand", "password": "demo123"}
    )
    if status == 200 and body.get("success"):
        token = body.get("session_token", "")
        cookie = f"token={token}"
        # Comment 102 is on post 101
        status2, body2 = api("/api/posts/101/comments", "GET", cookie=cookie)
        if status2 == 200:
            comments = body2.get("comments", [])

            def find_replies(comments_list, target_id):
                results = []
                for c in comments_list:
                    if c.get("parent_comment_id") == target_id:
                        results.append(c)
                    results.extend(find_replies(c.get("replies", []), target_id))
                return results

            api_replies = find_replies(comments, 102)
            # Only accept replies from mosi_brand (the brand account)
            mosi_replies = [
                r
                for r in api_replies
                if r.get("author_username") == "mosi_brand"
                or r.get("author_account_id") == 1
            ]
            if mosi_replies:
                reply_found = True
                SCORE += 0.2
                print(
                    f"PASS: Reply found via API to comment 102 (mosi_brand): "
                    f"'{mosi_replies[0].get('body', '')[:50]}'"
                )
            else:
                print("FAIL: No reply found to comment 102")
    else:
        print("FAIL: Could not login as mosi_brand to check replies")

# Completion gate: the reply-to-comment-102 workflow is the required artifact.
# Moderation-only solutions (hiding the three violating comments without replying)
# accumulate 0.6 from the hide checks alone — cap at 0.4 so they cannot cross
# the 0.5 success threshold without completing the required reply step.
if not reply_found:
    capped = min(SCORE, 0.4)
    if capped < SCORE:
        print(
            f"GATE: Required workflow artifact missing — score capped from "
            f"{SCORE:.1f} to {capped:.1f} (reply to comment 102 not posted)"
        )
    SCORE = capped

print(f"Score: {SCORE}/1.0")
sys.exit(0 if SCORE >= 0.5 else 1)
