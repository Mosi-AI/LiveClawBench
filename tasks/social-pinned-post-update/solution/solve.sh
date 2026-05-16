#!/usr/bin/env bash
set -euo pipefail

EMAIL_API="http://localhost:5001"
CALENDAR_API="http://localhost:5006"
SOCIAL_API="http://localhost:5004"

# ============================================================================
# Part 1: Email — login and read pinned post instructions
# ============================================================================

echo "[Email] Logging in as peter..."
EMAIL_LOGIN=$(curl -s -X POST "${EMAIL_API}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"peter","password":"password123"}')

EMAIL_TOKEN=$(echo "${EMAIL_LOGIN}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('access_token','') or json.load(sys.stdin).get('access_token',''))")
if [ -z "${EMAIL_TOKEN}" ]; then
  echo "FAIL: Email login failed"
  echo "Response: ${EMAIL_LOGIN}"
  exit 1
fi
echo "[Email] Login successful"

# Read inbox to find the pinned post email
echo "[Email] Reading inbox..."
INBOX=$(curl -s -X GET "${EMAIL_API}/api/emails?folder=inbox" \
  -H "Authorization: Bearer ${EMAIL_TOKEN}")

# Find the email about pinned post update
PINNED_EMAIL=$(echo "${INBOX}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
emails = data.get('data', data) if isinstance(data, dict) else data
if isinstance(emails, dict):
    emails = emails.get('emails', [])
for e in emails:
    subj = e.get('subject', '')
    if 'pinned' in subj.lower() or 'pin' in subj.lower():
        print(e.get('id', ''))
        break
")
echo "[Email] Found pinned post email: id=${PINNED_EMAIL}"

if [ -n "${PINNED_EMAIL}" ]; then
  EMAIL_DETAIL=$(curl -s -X GET "${EMAIL_API}/api/emails/${PINNED_EMAIL}" \
    -H "Authorization: Bearer ${EMAIL_TOKEN}")
  echo "[Email] Read email about pinned post update"
fi

# ============================================================================
# Part 2: Calendar — find verification code
# ============================================================================

echo "[Calendar] Logging in..."
CAL_LOGIN=$(curl -s -X POST "${CALENDAR_API}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"peter.griffin@work.mosi.inc","password":"password123"}')

CAL_TOKEN=$(echo "${CAL_LOGIN}" | python3 -c "import sys,json; r=json.load(sys.stdin); print(r.get('data',{}).get('access_token','') or r.get('access_token',''))")
if [ -z "${CAL_TOKEN}" ]; then
  echo "FAIL: Calendar login failed"
  echo "Response: ${CAL_LOGIN}"
  exit 1
fi
echo "[Calendar] Login successful"

echo "[Calendar] Looking for verification code..."
CAL_EVENTS=$(curl -s -X GET "${CALENDAR_API}/api/events" \
  -H "Authorization: Bearer ${CAL_TOKEN}")

VERIFICATION_CODE=$(echo "${CAL_EVENTS}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
events = data.get('events', data) if isinstance(data, dict) else data
if isinstance(events, dict):
    events = events.get('events', [])
for e in events:
    title = e.get('title', '')
    if 'Social Media Q2 Content Plan' in title:
        source_ref = e.get('source_ref', '')
        # Extract code from source_ref like 'VERIFICATION-CODE:SM-Q2-7842'
        if 'VERIFICATION-CODE:' in source_ref:
            print(source_ref.split('VERIFICATION-CODE:')[1])
        else:
            print(source_ref)
        break
")
echo "[Calendar] Found verification code: ${VERIFICATION_CODE}"

# ============================================================================
# Part 3: Social — login, unpin old, pin new
# ============================================================================

echo "[Social] Logging in as mosi_brand..."
SOCIAL_LOGIN=$(curl -s -X POST "${SOCIAL_API}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"mosi_brand","password":"demo123"}')

SOCIAL_TOKEN=$(echo "${SOCIAL_LOGIN}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('session_token',''))")
if [ -z "${SOCIAL_TOKEN}" ]; then
  echo "FAIL: Social login failed"
  echo "Response: ${SOCIAL_LOGIN}"
  exit 1
fi
SOCIAL_COOKIE="token=${SOCIAL_TOKEN}"
echo "[Social] Login successful"

# Unpin post_id=1 (currently pinned)
echo "[Social] Unpinning post_id=1..."
UNPIN_RESPONSE=$(curl -s -X POST "${SOCIAL_API}/api/posts/1/pin" \
  -H "Cookie: ${SOCIAL_COOKIE}")
echo "[Social] Unpin response: ${UNPIN_RESPONSE}"

# Pin post_id=9 (10K followers giveaway)
echo "[Social] Pinning post_id=9..."
PIN_RESPONSE=$(curl -s -X POST "${SOCIAL_API}/api/posts/9/pin" \
  -H "Cookie: ${SOCIAL_COOKIE}")
echo "[Social] Pin response: ${PIN_RESPONSE}"

# Verify final state
echo "[Social] Verifying final state..."
FINAL_FEED=$(curl -s -X GET "${SOCIAL_API}/api/posts" \
  -H "Cookie: ${SOCIAL_COOKIE}")

echo "${FINAL_FEED}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
posts = data if isinstance(data, list) else data.get('posts', [])
for p in posts:
    if p.get('id') in [1, 9]:
        print(f'  post_id={p[\"id\"]}, is_pinned={p.get(\"is_pinned\", 0)}')
"

echo ""
echo "=== Task complete ==="
echo "1. Read email with pinned post update instructions"
echo "2. Retrieved verification code from calendar: ${VERIFICATION_CODE}"
echo "3. Unpinned post_id=1 (launch announcement)"
echo "4. Pinned post_id=9 (10K followers giveaway)"
