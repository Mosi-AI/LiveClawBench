#!/usr/bin/env bash
# Deterministic reference solution for social-cross-publish (case_id=44).
#
# Flow:
#   1. Email login as peter / password123 → read access_token from data.access_token.
#   2. GET inbox, find the Cross-Publish campaign email (subject contains
#      "Cross-Publish Content to Social Media").
#   3. Calendar form login as peter.griffin@work.mosi.inc / password123 (cookie auth).
#   4. GET /api/events, find the "Summer Tech Summit 2026" event, derive the
#      June 15 date from start_time.
#   5. Social login as mosi_brand / demo123 (cookie auth via token).
#   6. POST /api/posts with status=published, content includes email-derived
#      phrases (early bird, save 30%, 50+ speakers), the June 15 calendar date,
#      and hashtags (#TechSummit2026 #SummerSummit #TechConference).
#   7. Assert HTTP 201 and success:true; exit non-zero on any failure.

set -euo pipefail

EMAIL_URL="http://127.0.0.1:5001"
CALENDAR_URL="http://127.0.0.1:5006"
SOCIAL_URL="http://127.0.0.1:5008"

EMAIL_USER="peter"
EMAIL_PASSWORD="password123"
CALENDAR_EMAIL="peter.griffin@work.mosi.inc"
CALENDAR_PASSWORD="password123"
SOCIAL_USER="mosi_brand"
SOCIAL_PASSWORD="demo123"

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
# 2. Read campaign email from inbox
# ---------------------------------------------------------------------------
INBOX_RESP="$WORK_DIR/inbox.json"
INBOX_STATUS=$(curl -sS -o "$INBOX_RESP" -w "%{http_code}" \
  -H "Authorization: Bearer $EMAIL_TOKEN" \
  "$EMAIL_URL/api/emails?folder=inbox")
require_http "200" "$INBOX_STATUS" "inbox listing"

python3 - <<'PY' "$INBOX_RESP" || fail "campaign email not found in inbox"
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
    if "cross-publish content to social media" in subject:
        sys.exit(0)
sys.exit(1)
PY

# ---------------------------------------------------------------------------
# 3. Calendar form login (cookie session)
# ---------------------------------------------------------------------------
CAL_COOKIE_JAR="$WORK_DIR/calendar_cookies.txt"
CAL_LOGIN_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" \
  -c "$CAL_COOKIE_JAR" \
  -X POST "$CALENDAR_URL/login" \
  --data-urlencode "email=$CALENDAR_EMAIL" \
  --data-urlencode "password=$CALENDAR_PASSWORD")
# Successful login redirects (302); a re-rendered LoginPage on failure is 200.
require_http "302,303" "$CAL_LOGIN_STATUS" "calendar login"

[[ -s "$CAL_COOKIE_JAR" ]] || fail "calendar login produced no cookie jar"
grep -q "token" "$CAL_COOKIE_JAR" || fail "calendar login did not set token cookie"

# ---------------------------------------------------------------------------
# 4. List calendar events → derive June 15 from "Summer Tech Summit 2026"
# ---------------------------------------------------------------------------
CAL_EVENTS_RESP="$WORK_DIR/calendar_events.json"
CAL_EVENTS_STATUS=$(curl -sS -o "$CAL_EVENTS_RESP" -w "%{http_code}" \
  -b "$CAL_COOKIE_JAR" \
  "$CALENDAR_URL/api/events")
require_http "200" "$CAL_EVENTS_STATUS" "calendar events listing"

CAL_DATE=$(python3 - <<'PY' "$CAL_EVENTS_RESP"
import json
import sys

with open(sys.argv[1]) as f:
    payload = json.load(f)

events = payload.get("events", []) if isinstance(payload, dict) else []
for ev in events:
    title = (ev.get("title") or "").lower()
    if "summer tech summit" in title or "tech summit 2026" in title:
        start_time = ev.get("start_time") or ""
        # start_time is ISO 8601 like 2026-06-15T09:00:00.000Z
        # Format as "June 15, 2026" so the verifier's `june 15` substring matches.
        from datetime import datetime
        try:
            dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        except ValueError:
            sys.exit("unable to parse start_time: " + start_time)
        print(dt.strftime("%B %d, %Y"))
        sys.exit(0)
sys.exit("Summer Tech Summit 2026 event not found in calendar")
PY
) || fail "calendar date extraction failed"

[[ "$CAL_DATE" == *"June 15"* ]] || fail "expected calendar date to contain 'June 15', got: $CAL_DATE"

# ---------------------------------------------------------------------------
# 5. Social login (cookie session)
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
# 6. POST /api/posts → published cross-publish post
# ---------------------------------------------------------------------------
# Content includes:
#   - Topic: "Summer Tech Summit" (dim 1)
#   - Email phrases: "Early bird", "save 30%", "50+ speaker sessions" (dim 3)
#   - Calendar-derived date: "June 15, 2026" (dim 5)
#   - Hashtags inline + as tags (dim 4: requires >=2 of
#     #TechSummit2026 / #SummerSummit / #TechConference)
read -r -d '' POST_CONTENT <<EOF || true
🚀 Summer Tech Summit 2026 is coming up on ${CAL_DATE}! Join us for 50+ speaker sessions, hands-on workshops, startup pitches, and evening networking. Early bird pricing ends June 30 — register now to save 30%! #TechSummit2026 #SummerSummit #TechConference
EOF

POST_BODY=$(python3 - <<'PY' "$POST_CONTENT"
import json
import sys
content = sys.argv[1]
payload = {
    "content": content,
    "visibility": "public",
    "status": "published",
    "tags": ["#TechSummit2026", "#SummerSummit", "#TechConference"],
    "assets": [],
}
print(json.dumps(payload))
PY
)

POST_RESP="$WORK_DIR/post_response.json"
POST_STATUS=$(curl -sS -o "$POST_RESP" -w "%{http_code}" \
  -X POST "$SOCIAL_URL/api/posts" \
  -H "Content-Type: application/json" \
  -H "Cookie: token=$SOCIAL_TOKEN" \
  -d "$POST_BODY")
require_http "200,201" "$POST_STATUS" "publish post"

python3 -c "
import json, sys
with open('$POST_RESP') as f:
    payload = json.load(f)
if not payload.get('success'):
    sys.exit('publish response missing success=true: ' + json.dumps(payload))
post_id = payload.get('post_id') or (payload.get('data') or {}).get('post_id')
if not post_id:
    sys.exit('publish response missing post_id: ' + json.dumps(payload))
print('Published post_id=' + str(post_id))
"

echo "social-cross-publish reference solution completed successfully"
