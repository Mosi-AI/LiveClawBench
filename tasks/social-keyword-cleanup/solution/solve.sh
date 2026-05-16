#!/usr/bin/env bash
set -euo pipefail

EMAIL_URL="http://localhost:5001"
SOCIAL_URL="http://localhost:5004"

# Step 1: Login to email to read the keyword instructions
echo "Logging into email..."
EMAIL_LOGIN=$(curl -sf -X POST "$EMAIL_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"peter","password":"password123"}')

EMAIL_TOKEN=$(echo "$EMAIL_LOGIN" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['access_token'])")
echo "Email login successful"

# Step 2: Get inbox emails and find the keyword cleanup email
echo "Fetching inbox..."
EMAILS_RESP=$(curl -sf -X GET "$EMAIL_URL/api/emails?folder=inbox" \
  -H "Authorization: Bearer $EMAIL_TOKEN")

# Find the email with subject "Remove Posts with Specific Keywords"
KEYWORD_EMAIL=$(echo "$EMAILS_RESP" | python3 -c "
import sys, json
data = json.load(sys.stdin)
emails = data.get('data', {}).get('emails', data.get('emails', []))
for e in emails:
    if 'Remove Posts with Specific Keywords' in e.get('subject', ''):
        print(json.dumps(e))
        break
")

if [ -z "$KEYWORD_EMAIL" ]; then
  echo "ERROR: Could not find keyword cleanup email"
  exit 1
fi

# Extract keywords from email body
echo "Found keyword cleanup email"
KEYWORDS=$(echo "$KEYWORD_EMAIL" | python3 -c "
import sys, json, re
email = json.load(sys.stdin)
body = email.get('body', '')
# Extract keywords from lines like '- \"giveaway\"'
keywords = re.findall(r'[-*]\s*\"([^\"]+)\"', body)
print(' '.join(keywords))
")

echo "Keywords to delete: $KEYWORDS"

# Step 3: Login to social media as mosi_brand
echo "Logging into social media..."
SOCIAL_LOGIN=$(curl -sf -X POST "$SOCIAL_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"mosi_brand","password":"demo123"}')

SOCIAL_TOKEN=$(echo "$SOCIAL_LOGIN" | python3 -c "import sys, json; print(json.load(sys.stdin)['session_token'])")
echo "Social media login successful"

# Step 4: Get all published posts by mosi_brand and delete matching ones
echo "Fetching mosi_brand posts..."
POSTS_RESP=$(curl -sf -X GET "$SOCIAL_URL/api/posts?author_id=1&limit=100" \
  -H "Authorization: Bearer $SOCIAL_TOKEN")

# Find posts matching keywords and delete them
echo "$POSTS_RESP" | python3 -c "
import sys, json, urllib.request, urllib.error

keywords = '$KEYWORDS'.split()
posts = json.load(sys.stdin).get('posts', [])
token = '$SOCIAL_TOKEN'
base_url = '$SOCIAL_URL'

deleted = []
for p in posts:
    content_lower = p['content'].lower()
    if any(kw.lower() in content_lower for kw in keywords):
        post_id = p['id']
        url = f'{base_url}/api/posts/{post_id}'
        req = urllib.request.Request(url, method='DELETE',
            headers={'Authorization': f'Bearer {token}',
                     'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read().decode('utf-8'))
                print(f'Deleted post {post_id}: {p[\"content\"][:60]}...')
                deleted.append(post_id)
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8') if e.fp else ''
            print(f'ERROR deleting post {post_id}: HTTP {e.code}: {body}')

print(f'Total deleted: {len(deleted)} posts')
"

# Step 5: Verify deletion
echo "Verifying deletion..."
VERIFY_RESP=$(curl -sf -X GET "$SOCIAL_URL/api/posts?author_id=1&limit=100" \
  -H "Authorization: Bearer $SOCIAL_TOKEN")

echo "$VERIFY_RESP" | python3 -c "
import sys, json
data = json.load(sys.stdin)
posts = data.get('posts', [])
keywords = '$KEYWORDS'.split()
violations = []
for p in posts:
    content_lower = p['content'].lower()
    if any(kw.lower() in content_lower for kw in keywords):
        violations.append(p['id'])
if violations:
    print(f'WARNING: {len(violations)} keyword-matching posts remain: {violations}')
else:
    print('All keyword-matching posts deleted successfully')
print(f'Remaining published posts: {len(posts)}')
"

echo "Done"
