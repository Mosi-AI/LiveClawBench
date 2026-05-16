#!/usr/bin/env bash
# Deterministic reference solution for social-pinned-post-update (case_id=45).
#
# Flow:
#   1. Email login as peter / password123 → read access_token from data.access_token.
#   2. GET inbox, confirm presence of the pinned-post-update email.
#   3. Calendar form login (email=peter.griffin@work.mosi.inc / password123) →
#      cookie jar (POST /login is form-encoded, returns 302 + token cookie).
#   4. GET /api/events with cookie auth, find "Social Media Q2 Content Plan",
#      extract verification code from source_ref (format
#      "VERIFICATION-CODE:SM-Q2-7842").
#   5. Social login as mosi_brand / demo123 → top-level session_token (cookie).
#   6. POST /api/posts/1/pin → toggles pinned (1→0): unpins launch announcement.
#   7. POST /api/posts/9/pin → toggles pinned (0→1): pins 10K followers
#      giveaway. The mock auto-unpins any other pinned post owned by the same
#      author when pinning a new one.
#   8. POST /api/emails with send_now=true, recipient=social-team@mosi.inc.
#      Subject + body MUST contain ALL of:
#        - verification code (SM-Q2-7842 from calendar)
#        - new-pin cue: "10K" or "giveaway"
#        - old-unpin cue: BOTH "launch" AND "unpinned"
#   9. Assert HTTP + success:true at every step; exit non-zero on any failure.

set -euo pipefail

EMAIL_URL="http://127.0.0.1:5001"
CALENDAR_URL="http://127.0.0.1:5006"
SOCIAL_URL="http://127.0.0.1:5004"

EMAIL_USER="peter"
EMAIL_PASSWORD="password123"
CALENDAR_EMAIL="peter.griffin@work.mosi.inc"
CALENDAR_PASSWORD="password123"
SOCIAL_USER="mosi_brand"
SOCIAL_PASSWORD="demo123"

OLD_POST_ID=1
NEW_POST_ID=9
CONFIRMATION_RECIPIENT="social-team@mosi.inc"

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
# 1. Email login → data.access_token
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
# 2. Read inbox → confirm presence of pinned-post-update email
# ---------------------------------------------------------------------------
INBOX_RESP="$WORK_DIR/inbox.json"
INBOX_STATUS=$(curl -sS -o "$INBOX_RESP" -w "%{http_code}" \
  -H "Authorization: Bearer $EMAIL_TOKEN" \
  "$EMAIL_URL/api/emails?folder=inbox")
require_http "200" "$INBOX_STATUS" "inbox listing"

python3 - <<'PY' "$INBOX_RESP" || fail "pinned-post update email not found in inbox"
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
    if "pin" in subject:
        sys.exit(0)
sys.exit(1)
PY

# ---------------------------------------------------------------------------
# 3. Calendar form login → cookie jar (form-encoded POST /login, 302 + token cookie)
# ---------------------------------------------------------------------------
CAL_COOKIE_JAR="$WORK_DIR/calendar_cookies.txt"
CAL_LOGIN_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" \
  -c "$CAL_COOKIE_JAR" \
  -X POST "$CALENDAR_URL/login" \
  --data-urlencode "email=$CALENDAR_EMAIL" \
  --data-urlencode "password=$CALENDAR_PASSWORD")
require_http "302,303" "$CAL_LOGIN_STATUS" "calendar login"

[[ -s "$CAL_COOKIE_JAR" ]] || fail "calendar login produced no cookie jar"
grep -q "token" "$CAL_COOKIE_JAR" || fail "calendar login did not set token cookie"

# ---------------------------------------------------------------------------
# 4. List calendar events → extract verification code from "Social Media Q2 Content Plan"
# ---------------------------------------------------------------------------
CAL_EVENTS_RESP="$WORK_DIR/calendar_events.json"
CAL_EVENTS_STATUS=$(curl -sS -o "$CAL_EVENTS_RESP" -w "%{http_code}" \
  -b "$CAL_COOKIE_JAR" \
  "$CALENDAR_URL/api/events")
require_http "200" "$CAL_EVENTS_STATUS" "calendar events listing"

VERIFICATION_CODE=$(python3 - <<'PY' "$CAL_EVENTS_RESP"
import json
import sys

with open(sys.argv[1]) as f:
    payload = json.load(f)

events = payload.get("events", []) if isinstance(payload, dict) else []
for ev in events:
    title = (ev.get("title") or "")
    if "Social Media Q2 Content Plan" in title:
        source_ref = ev.get("source_ref") or ""
        # source_ref format: "VERIFICATION-CODE:SM-Q2-7842"
        if "VERIFICATION-CODE:" in source_ref:
            print(source_ref.split("VERIFICATION-CODE:", 1)[1].strip())
            sys.exit(0)
        print(source_ref.strip())
        sys.exit(0)
sys.exit("Social Media Q2 Content Plan event not found in calendar")
PY
) || fail "verification code extraction failed"

[[ -n "$VERIFICATION_CODE" ]] || fail "extracted verification code is empty"

# ---------------------------------------------------------------------------
# 5. Social login → top-level session_token (cookie auth)
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
# 6. Toggle-unpin post 1 (currently pinned). POST /api/posts/1/pin flips
#    is_pinned: 1 → 0.
# ---------------------------------------------------------------------------
UNPIN_RESP="$WORK_DIR/unpin.json"
UNPIN_STATUS=$(curl -sS -o "$UNPIN_RESP" -w "%{http_code}" \
  -X POST "$SOCIAL_URL/api/posts/$OLD_POST_ID/pin" \
  -H "Cookie: token=$SOCIAL_TOKEN")
require_http "200" "$UNPIN_STATUS" "unpin post $OLD_POST_ID"

python3 - <<'PY' "$UNPIN_RESP" || fail "unpin response did not report pinned=false"
import json, sys
with open(sys.argv[1]) as f:
    payload = json.load(f)
if payload.get("pinned") is not False:
    sys.exit("unpin response: " + json.dumps(payload))
PY

# ---------------------------------------------------------------------------
# 7. Toggle-pin post 9 (currently unpinned). POST /api/posts/9/pin flips
#    is_pinned: 0 → 1. The mock auto-unpins any other pinned post owned by the
#    same author when pinning, so this is idempotent w.r.t. step 6.
# ---------------------------------------------------------------------------
PIN_RESP="$WORK_DIR/pin.json"
PIN_STATUS=$(curl -sS -o "$PIN_RESP" -w "%{http_code}" \
  -X POST "$SOCIAL_URL/api/posts/$NEW_POST_ID/pin" \
  -H "Cookie: token=$SOCIAL_TOKEN")
require_http "200" "$PIN_STATUS" "pin post $NEW_POST_ID"

python3 - <<'PY' "$PIN_RESP" || fail "pin response did not report pinned=true"
import json, sys
with open(sys.argv[1]) as f:
    payload = json.load(f)
if payload.get("pinned") is not True:
    sys.exit("pin response: " + json.dumps(payload))
PY

# ---------------------------------------------------------------------------
# 8. Send confirmation email with verification code + both pin-change cues.
#    Body MUST contain:
#      - the verification code (e.g. "SM-Q2-7842")
#      - a new-pin cue: "10K" or "giveaway"
#      - an old-unpin cue: BOTH "launch" AND "unpinned"
# ---------------------------------------------------------------------------
REPORT_BODY="Pinned post update confirmed.

The launch announcement post (post_id=$OLD_POST_ID) has been unpinned.
The 10K followers giveaway post (post_id=$NEW_POST_ID) is now pinned.

Verification code from the Social Media Q2 Content Plan calendar event: $VERIFICATION_CODE"

EMAIL_SEND_BODY=$(python3 - <<PY
import json
print(json.dumps({
    "recipient": "$CONFIRMATION_RECIPIENT",
    "subject": "Pinned Post Update Confirmed ($VERIFICATION_CODE)",
    "body": """$REPORT_BODY""",
    "send_now": True,
}))
PY
)

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

echo "social-pinned-post-update reference solution completed successfully"
