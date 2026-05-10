#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:5004"
USERNAME="alice"
PASSWORD="demo123"

# Step 1: Login as alice
echo "Step 1: Logging in as alice..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

SUCCESS=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print('true') if json.load(sys.stdin).get('success') else print('false')")
if [ "$SUCCESS" != "true" ]; then
  echo "ERROR: Failed to login as alice"
  exit 1
fi

COOKIE="token=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('session_token', ''))")"
echo "Got session cookie: $COOKIE"

# Step 2: Get baseline feed and find a post with liked=true
echo "Step 2: Getting baseline feed to discover liked posts..."
POSTS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/posts" \
  -H "Cookie: $COOKIE")

# Find first post with liked=true and record its id and like_count
LIKED_INFO=$(echo "$POSTS_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
posts = data if isinstance(data, list) else data.get('posts', [])
for p in posts:
    if p.get('liked') == True:
        print(f\"FOUND liked=true: id={p['id']}, like_count={p.get('like_count', -1)}\")
        break
else:
    print('ERROR: no liked=true posts found')
")
echo "Discovery result: $LIKED_INFO"

if [[ "$LIKED_INFO" == "ERROR:"* ]]; then
  echo "ERROR: $LIKED_INFO"
  exit 1
fi

# Parse POST_ID and BASELINE_COUNT from LIKED_INFO
POST_ID=$(echo "$LIKED_INFO" | python3 -c "import sys; line=sys.stdin.read().strip(); print(line.split('id=')[1].split(',')[0])")
BASELINE_COUNT=$(echo "$LIKED_INFO" | python3 -c "import sys; line=sys.stdin.read().strip(); print(line.split('like_count=')[1])")
echo "Target post_id=$POST_ID, baseline like_count=$BASELINE_COUNT"

# Step 3: Toggle like (unlikes since alice already liked it)
echo "Step 3: Toggling like on post $POST_ID..."
UNLIKE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/posts/$POST_ID/like" \
  -H "Cookie: $COOKIE")

UNLIKE_LIKED=$(echo "$UNLIKE_RESPONSE" | python3 -c "import sys, json; resp=json.load(sys.stdin); print(resp.get('liked'))")
echo "Toggle response: liked=$UNLIKE_LIKED"

if [ "$UNLIKE_LIKED" != "False" ]; then
  echo "ERROR: Toggle did not return liked=False"
  exit 1
fi

# Step 4: Get final feed and verify liked=false AND like_count decreased by 1
echo "Step 4: Verifying final state..."
FINAL_RESPONSE=$(curl -s -X GET "$BASE_URL/api/posts" \
  -H "Cookie: $COOKIE")

RESULT=$(echo "$FINAL_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
posts = data if isinstance(data, list) else data.get('posts', [])
for p in posts:
    if p.get('id') == $POST_ID:
        final_liked = p.get('liked', True)
        final_count = p.get('like_count', -1)
        baseline = $BASELINE_COUNT
        if final_liked == False and final_count == baseline - 1:
            print(f'SUCCESS: post_id=$POST_ID liked={final_liked} like_count={final_count} (baseline=$baseline)')
        elif final_liked == False:
            print(f'FAIL_COUNT: liked=false but like_count={final_count} (expected {baseline-1})')
        else:
            print(f'FAIL_LIKE: post_id=$POST_ID liked={final_liked} (expected False - replacement-like detected)')
        break
else:
    print('ERROR: post_id=$POST_ID not found in final feed')
")
echo "$RESULT"

if [[ "$RESULT" == "SUCCESS:"* ]]; then
  echo "SUCCESS: Post unliked and verified with count decrement"
  exit 0
else
  echo "FAIL: $RESULT"
  exit 1
fi