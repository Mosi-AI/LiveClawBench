#!/usr/bin/env bash
# Deterministic reference solution for social-event-campaign (case_id=43).
#
# Flow:
#   1. Email login as peter / password123 → read access_token from data.access_token.
#   2. GET inbox, confirm presence of "Publish Event Campaign Post" instruction.
#   3. Social login as mosi_brand / demo123 → top-level session_token (cookie).
#   4. GET /api/posts/101 → assert status == "draft" (sanity check).
#   5. PUT /api/posts/101 with status=published, tags=[], assets=[] →
#      mock auto-sets published_at on transition.
#   6. GET /api/posts/101 again → assert status == "published".
#   7. POST /api/emails with send_now=true, recipient=events@mosi.inc,
#      subject containing "Event Campaign Published".
#   8. Assert HTTP + success:true at every step; exit non-zero on any failure.

set -euo pipefail

EMAIL_URL="http://127.0.0.1:5001"
SOCIAL_URL="http://127.0.0.1:5008"

EMAIL_USER="peter"
EMAIL_PASSWORD="password123"
SOCIAL_USER="mosi_brand"
SOCIAL_PASSWORD="demo123"

POST_ID=101
CONFIRMATION_RECIPIENT="events@mosi.inc"
CONFIRMATION_SUBJECT="Event Campaign Published"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

fail() {
  echo "FATAL: $*" >&2
  exit 1
}

require_http() {
  # require_http <expected_status_csv> <actual_status> <context>
  local expected="$1" actual="$2" context="$3"
  case ",$expected," in
    *",$actual,"*) return 0 ;;
  esac
  fail "$context: expected HTTP [$expected], got $actual"
}

# ---------------------------------------------------------------------------
# 1. Email login → access_token
# ---------------------------------------------------------------------------
EMAIL_LOGIN_BODY=$(printf '{"username":"%s","password":"%s"}' "$EMAIL_USER" "$EMAIL_PASSWORD")
EMAIL_LOGIN_RESP="$WORK_DIR/email_login.json"
EMAIL_LOGIN_STATUS=$(curl -sS -o "$EMAIL_LOGIN_RESP" -w "%{http_code}" \
  -X POST "$EMAIL_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "$EMAIL_LOGIN_BODY")
require_http "200,201" "$EMAIL_LOGIN_STATUS" "email login"

EMAIL_TOKEN=$(python3 -c "
import json, sys
with open('$EMAIL_LOGIN_RESP') as f:
    payload = json.load(f)
if not payload.get('success'):
    sys.exit('email login response missing success=true: ' + json.dumps(payload))
token = (payload.get('data') or {}).get('access_token', '')
if not token:
    sys.exit('email login response missing data.access_token: ' + json.dumps(payload))
print(token)
")
[[ -n "$EMAIL_TOKEN" ]] || fail "email login produced empty access_token"

# ---------------------------------------------------------------------------
# 2. Read campaign instruction email from inbox
# ---------------------------------------------------------------------------
INBOX_RESP="$WORK_DIR/inbox.json"
INBOX_STATUS=$(curl -sS -o "$INBOX_RESP" -w "%{http_code}" \
  -H "Authorization: Bearer $EMAIL_TOKEN" \
  "$EMAIL_URL/api/emails?folder=inbox")
require_http "200" "$INBOX_STATUS" "inbox listing"

python3 - <<'PY' "$INBOX_RESP" || fail "event campaign instruction email not found in inbox"
import json
import sys

with open(sys.argv[1]) as f:
    payload = json.load(f)

emails = payload.get("data") if isinstance(payload, dict) else None
if isinstance(emails, dict):
    emails = emails.get("emails", [])
if emails is None:
    emails = payload.get("emails", []) if isinstance(payload, dict) else []

for e in emails:
    subject = (e.get("subject") or "").lower()
    if "publish event campaign post" in subject:
        sys.exit(0)
sys.exit(1)
PY

# ---------------------------------------------------------------------------
# 3. Social login → session_token (cookie auth)
# ---------------------------------------------------------------------------
SOCIAL_LOGIN_BODY=$(printf '{"username":"%s","password":"%s"}' "$SOCIAL_USER" "$SOCIAL_PASSWORD")
SOCIAL_LOGIN_RESP="$WORK_DIR/social_login.json"
SOCIAL_LOGIN_STATUS=$(curl -sS -o "$SOCIAL_LOGIN_RESP" -w "%{http_code}" \
  -X POST "$SOCIAL_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "$SOCIAL_LOGIN_BODY")
require_http "200,201" "$SOCIAL_LOGIN_STATUS" "social login"

SOCIAL_TOKEN=$(python3 -c "
import json, sys
with open('$SOCIAL_LOGIN_RESP') as f:
    payload = json.load(f)
if not payload.get('success'):
    sys.exit('social login response missing success=true: ' + json.dumps(payload))
token = payload.get('session_token') or (payload.get('data') or {}).get('session_token', '')
if not token:
    sys.exit('social login response missing session_token: ' + json.dumps(payload))
print(token)
")
[[ -n "$SOCIAL_TOKEN" ]] || fail "social login produced empty session_token"

# ---------------------------------------------------------------------------
# 4. Sanity check: post 101 starts as draft
# ---------------------------------------------------------------------------
POST_GET_RESP="$WORK_DIR/post_get_initial.json"
POST_GET_STATUS=$(curl -sS -o "$POST_GET_RESP" -w "%{http_code}" \
  -H "Cookie: token=$SOCIAL_TOKEN" \
  "$SOCIAL_URL/api/posts/$POST_ID")
require_http "200" "$POST_GET_STATUS" "GET draft post"

python3 - <<'PY' "$POST_GET_RESP" || fail "post $POST_ID does not start in draft status"
import json
import sys

with open(sys.argv[1]) as f:
    payload = json.load(f)

post = payload.get("post") if isinstance(payload, dict) else None
if not isinstance(post, dict):
    # Some endpoints return the post at the top level.
    post = payload if isinstance(payload, dict) else {}
status = (post.get("status") or "").lower()
if status != "draft":
    sys.exit("expected draft, got: " + status)
sys.exit(0)
PY

# ---------------------------------------------------------------------------
# 5. PUT /api/posts/101 → flip draft to published
# ---------------------------------------------------------------------------
# The mock requires tags AND assets in the body whenever content/status/
# visibility/scheduled_for/scheduled_timezone change. We only change status,
# but still need both fields present.
PUBLISH_BODY=$(python3 -c "
import json
print(json.dumps({'status': 'published', 'tags': [], 'assets': []}))
")
PUBLISH_RESP="$WORK_DIR/publish.json"
PUBLISH_STATUS=$(curl -sS -o "$PUBLISH_RESP" -w "%{http_code}" \
  -X PUT "$SOCIAL_URL/api/posts/$POST_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: token=$SOCIAL_TOKEN" \
  -d "$PUBLISH_BODY")
require_http "200" "$PUBLISH_STATUS" "publish post (PUT)"

python3 -c "
import json, sys
with open('$PUBLISH_RESP') as f:
    payload = json.load(f)
if not payload.get('success'):
    sys.exit('publish response missing success=true: ' + json.dumps(payload))
"

# ---------------------------------------------------------------------------
# 6. Verify post 101 is now published
# ---------------------------------------------------------------------------
POST_VERIFY_RESP="$WORK_DIR/post_verify.json"
POST_VERIFY_STATUS=$(curl -sS -o "$POST_VERIFY_RESP" -w "%{http_code}" \
  -H "Cookie: token=$SOCIAL_TOKEN" \
  "$SOCIAL_URL/api/posts/$POST_ID")
require_http "200" "$POST_VERIFY_STATUS" "GET published post"

python3 - <<'PY' "$POST_VERIFY_RESP" || fail "post $POST_ID was not transitioned to published"
import json
import sys

with open(sys.argv[1]) as f:
    payload = json.load(f)

post = payload.get("post") if isinstance(payload, dict) else None
if not isinstance(post, dict):
    post = payload if isinstance(payload, dict) else {}
status = (post.get("status") or "").lower()
if status != "published":
    sys.exit("expected published, got: " + status)
sys.exit(0)
PY

# ---------------------------------------------------------------------------
# 7. Send confirmation email to events@mosi.inc (folder='sent', send_now=true)
# ---------------------------------------------------------------------------
EMAIL_SEND_BODY=$(python3 -c "
import json
print(json.dumps({
    'recipient': '$CONFIRMATION_RECIPIENT',
    'subject': '$CONFIRMATION_SUBJECT',
    'body': 'Confirming that the Mosi Tech Innovation Summit 2026 event campaign post (post_id=$POST_ID) has been published on the social platform. Early bird registration links and event details are now live for community engagement.',
    'send_now': True,
}))
")
EMAIL_SEND_RESP="$WORK_DIR/email_send.json"
EMAIL_SEND_STATUS=$(curl -sS -o "$EMAIL_SEND_RESP" -w "%{http_code}" \
  -X POST "$EMAIL_URL/api/emails" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $EMAIL_TOKEN" \
  -d "$EMAIL_SEND_BODY")
require_http "200,201" "$EMAIL_SEND_STATUS" "send confirmation email"

python3 -c "
import json, sys
with open('$EMAIL_SEND_RESP') as f:
    payload = json.load(f)
if not payload.get('success'):
    sys.exit('email send response missing success=true: ' + json.dumps(payload))
"

echo "social-event-campaign reference solution completed successfully"
