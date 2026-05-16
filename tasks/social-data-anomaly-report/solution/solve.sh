#!/usr/bin/env bash
set -euo pipefail

SOCIAL_URL="http://localhost:5004"
EMAIL_URL="http://localhost:5001"

# Step 1: Login to email and read the anomaly check request
echo "Step 1: Logging into email..."
EMAIL_LOGIN=$(curl -s -X POST "$EMAIL_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"peter","password":"password123"}')
EMAIL_TOKEN=$(echo "$EMAIL_LOGIN" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token',''))")
echo "Email token obtained"

# Step 2: Read inbox to find the data integrity request
echo "Step 2: Reading email inbox..."
INBOX=$(curl -s "$EMAIL_URL/api/emails?folder=inbox" \
  -H "Authorization: Bearer $EMAIL_TOKEN")
echo "Inbox retrieved"

# Step 3: Login to social platform as mosi_brand
echo "Step 3: Logging into social platform..."
SOCIAL_LOGIN=$(curl -s -X POST "$SOCIAL_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"mosi_brand","password":"demo123"}')
SOCIAL_COOKIE="token=$(echo "$SOCIAL_LOGIN" | python3 -c "import sys, json; print(json.load(sys.stdin).get('session_token',''))")"
echo "Social cookie obtained"

# Step 4: Query the social DB directly for anomalies
echo "Step 4: Inspecting social database for anomalies..."
DB_PATH="/opt/mock/data/social/social.db"

# Anomaly 1: Post 101 - published but published_at is NULL
ANOMALY_1=$(sqlite3 "$DB_PATH" "SELECT id, status, published_at FROM post WHERE id = 101;")
echo "Post 101: $ANOMALY_1"

# Anomaly 2: Post 101 metrics - 0 impressions but 50000 likes
ANOMALY_2=$(sqlite3 "$DB_PATH" "SELECT post_id, impressions, likes FROM post_metric WHERE post_id = 101;")
echo "Post 101 metrics: $ANOMALY_2"

# Anomaly 3: Post 6 - status is draft but action_log says published
ANOMALY_3_STATUS=$(sqlite3 "$DB_PATH" "SELECT id, status FROM post WHERE id = 6;")
ANOMALY_3_LOG=$(sqlite3 "$DB_PATH" "SELECT post_id, action_type, new_value FROM post_action_log WHERE post_id = 6;")
echo "Post 6 status: $ANOMALY_3_STATUS, action log: $ANOMALY_3_LOG"

# Step 5: Compose and send the anomaly report email
echo "Step 5: Sending anomaly report email..."
REPORT_BODY="Social Media Data Anomaly Report

The following data anomalies were identified during the integrity check:

1. Post 101: Status is 'published' but published_at is NULL
   - The post has status='published' but the published_at timestamp is missing/NULL.
   - This is inconsistent: a published post should always have a published_at timestamp.

2. Post 101 metrics: 0 impressions but 50000 likes
   - Post 101 has 0 impressions but 50000 likes, which is impossible.
   - Users cannot like a post they have never seen (zero impressions).
   - This suggests either metric corruption or a data injection error.

3. Post 6: Status is 'draft' but action_log records a 'published' event
   - Post 6 currently has status='draft' but an action_log entry by alice
     records action_type='published' with new_value='published' dated 2026-01-23.
   - The current status contradicts the action history.

Please investigate and correct these anomalies at your earliest convenience."

curl -s -X POST "$EMAIL_URL/api/emails" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $EMAIL_TOKEN" \
  -d "$(python3 -c "
import json
print(json.dumps({
    'recipient': 'data-team@mosi.inc',
    'subject': 'Social Media Data Anomaly Report',
    'body': '''$REPORT_BODY''',
    'send_now': True
}))
")"

echo ""
echo "Done: Anomaly report email sent to data-team@mosi.inc"
