#!/usr/bin/env bash
# Deterministic reference solution for social-data-anomaly-report (case_id=42).
#
# Flow:
#   1. Email login as peter / password123 → read access_token from data.access_token.
#   2. GET inbox, confirm presence of the data-integrity request.
#   3. Social login as mosi_brand / demo123 (sanity check; cookie auth via
#      top-level session_token).
#   4. Query /var/lib/mock-data/social/social.db to confirm three seeded anomalies:
#        a. post 101: status='published' but published_at IS NULL
#        b. post 101 metrics: 0 impressions but 50000 likes
#        c. post 6: status='draft' but post_action_log records 'published'
#   5. POST /api/emails with send_now=true, recipient=data-team@mosi.inc,
#      subject="Social Media Data Anomaly Report", body containing keyword
#      coverage for all three anomalies (verifier requires ≥2 of 3).
#   6. Assert HTTP + success:true at every step; exit non-zero on any failure.

set -euo pipefail

EMAIL_URL="http://127.0.0.1:5001"
SOCIAL_URL="http://127.0.0.1:5008"

EMAIL_USER="peter"
EMAIL_PASSWORD="password123"
SOCIAL_USER="mosi_brand"
SOCIAL_PASSWORD="demo123"

SOCIAL_DB="/var/lib/mock-data/social/social.db"

REPORT_RECIPIENT="data-team@mosi.inc"
REPORT_SUBJECT="Social Media Data Anomaly Report"

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
# 2. Read inbox → confirm presence of data integrity request
# ---------------------------------------------------------------------------
INBOX_RESP="$WORK_DIR/inbox.json"
INBOX_STATUS=$(curl -sS -o "$INBOX_RESP" -w "%{http_code}" \
  -H "Authorization: Bearer $EMAIL_TOKEN" \
  "$EMAIL_URL/api/emails?folder=inbox")
require_http "200" "$INBOX_STATUS" "inbox listing"

python3 - <<'PY' "$INBOX_RESP" || fail "data integrity request email not found in inbox"
import json
import sys

with open(sys.argv[1]) as f:
    payload = json.load(f)

emails = payload.get("data") if isinstance(payload, dict) else None
if isinstance(emails, dict):
    emails = emails.get("emails", [])
if emails is None:
    emails = payload.get("emails", []) if isinstance(payload, dict) else []

needles = (
    "data integrity",
    "data anomal",
    "data anomaly",
    "anomaly check",
    "anomaly report",
)
for e in emails:
    haystack = ((e.get("subject") or "") + " " + (e.get("body") or "")).lower()
    if any(n in haystack for n in needles):
        sys.exit(0)
sys.exit(1)
PY

# ---------------------------------------------------------------------------
# 3. Social login (cookie auth sanity check)
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
# 4. Inspect social DB for the three seeded anomalies
# ---------------------------------------------------------------------------
[[ -f "$SOCIAL_DB" ]] || fail "social DB not found at $SOCIAL_DB"

# Anomaly A: post 101 published with NULL published_at
ANOMALY_A=$(sqlite3 "$SOCIAL_DB" \
  "SELECT id, status, IFNULL(published_at,'NULL') FROM post WHERE id = 101;")
case "$ANOMALY_A" in
  *"published|NULL"*) : ;;
  *) fail "post 101 anomaly missing (got: $ANOMALY_A)" ;;
esac

# Anomaly B: post 101 metrics (0 impressions, 50000 likes)
ANOMALY_B=$(sqlite3 "$SOCIAL_DB" \
  "SELECT impressions, likes FROM post_metric WHERE post_id = 101;")
case "$ANOMALY_B" in
  "0|50000") : ;;
  *) fail "post 101 metric anomaly missing (got: $ANOMALY_B)" ;;
esac

# Anomaly C: post 6 draft in `post`, but action_log says published
ANOMALY_C_STATUS=$(sqlite3 "$SOCIAL_DB" \
  "SELECT status FROM post WHERE id = 6;")
ANOMALY_C_LOG=$(sqlite3 "$SOCIAL_DB" \
  "SELECT action_type FROM post_action_log WHERE post_id = 6 AND action_type LIKE '%publish%' LIMIT 1;")
[[ "$ANOMALY_C_STATUS" == "draft" ]] || fail "post 6 status anomaly missing (got: $ANOMALY_C_STATUS)"
[[ -n "$ANOMALY_C_LOG" ]] || fail "post 6 action_log anomaly missing"

# ---------------------------------------------------------------------------
# 5. Compose + send the anomaly report email
# ---------------------------------------------------------------------------
# Body MUST contain keyword coverage for ≥2 of the 3 anomalies (each requires
# ≥2 keyword matches per verify.py ANOMALY_KEYWORDS). We cover all 3 groups:
#   - Group 1: "101", "published_at", "null", "missing timestamp"
#   - Group 2: "50000", "0 impressions", "zero impressions", "likes without impressions"
#   - Group 3: "post 6", "draft", "action_log", "contradict", "log says published"
REPORT_BODY=$(cat <<'TXT'
Social Media Data Anomaly Report

The following data anomalies were identified during the integrity check:

1. Post 101: status='published' but published_at is NULL (missing timestamp)
   - The record has status='published' yet the published_at column is NULL.
   - Every published post must have a non-null published_at; this row violates that invariant.

2. Post 101 metrics: 0 impressions but 50000 likes (likes without impressions)
   - post_metric for post_id=101 shows zero impressions while reporting 50000 likes.
   - Likes cannot exist without prior impressions — this is an impossible metric / implausible metric combination.

3. Post 6: status='draft' but action_log records a 'published' event (status mismatch / contradict log says published)
   - The post row reports status='draft', yet post_action_log records action_type='published' for post_id=6.
   - The current status contradicts the historical action_log entry; either the row was reverted out-of-band or the log is stale.

Please investigate and reconcile these anomalies at your earliest convenience.
TXT
)

EMAIL_SEND_BODY=$(python3 - <<PY
import json
print(json.dumps({
    "recipient": "$REPORT_RECIPIENT",
    "subject": "$REPORT_SUBJECT",
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
require_http "200,201" "$EMAIL_SEND_STATUS" "send anomaly report email"

python3 -c "
import json, sys
with open('$EMAIL_SEND_RESP') as f:
    payload = json.load(f)
if not payload.get('success'):
    sys.exit('email send response missing success=true: ' + json.dumps(payload))
"

echo "social-data-anomaly-report reference solution completed successfully"
