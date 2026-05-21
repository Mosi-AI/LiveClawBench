#!/usr/bin/env bash
set -euo pipefail

CALENDAR_API="http://localhost:5006"
EMAIL="peter.griffin@work.mosi.inc"
PASSWORD="password123"

# Login to calendar
LOGIN_RESPONSE=$(curl -s -c /tmp/cal_cookie -X POST "${CALENDAR_API}/login" \
  -d "email=${EMAIL}&password=${PASSWORD}" -L)

# Find the old meeting event (May 22 14:00-15:00)
EVENTS=$(curl -s -b /tmp/cal_cookie "${CALENDAR_API}/api/events")
OLD_EVENT_ID=$(echo "$EVENTS" | python3 -c "
import sys, json
for e in json.load(sys.stdin).get('events', []):
    if e.get('start_time','').startswith('2026-05-22T14:00'):
        print(e['id'])
        break
" || true)

# Delete old event
if [ -n "$OLD_EVENT_ID" ]; then
    curl -s -b /tmp/cal_cookie -X DELETE "${CALENDAR_API}/api/events/${OLD_EVENT_ID}"
    echo "Deleted old event ${OLD_EVENT_ID}"
fi

# Create new event at rescheduled time
curl -s -b /tmp/cal_cookie -X POST "${CALENDAR_API}/api/events" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Project Sync (Rescheduled)",
    "description": "Weekly project sync - rescheduled from May 22",
    "event_type": "appointment",
    "start_time": "2026-05-23T10:00:00Z",
    "end_time": "2026-05-23T11:00:00Z"
  }'

echo "Created new meeting event"

# Login to email API (JSON, Bearer token)
EMAIL_LOGIN=$(curl -s -X POST "http://localhost:5001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"peter","password":"password123"}')
EMAIL_TOKEN=$(echo "$EMAIL_LOGIN" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['access_token'])")

# Send confirmation email to HR via JSON API
curl -s -X POST "http://localhost:5001/api/emails" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${EMAIL_TOKEN}" \
  -d '{
    "recipient": "hr@work.mosi.inc",
    "subject": "Re: Meeting Reschedule - Project Sync",
    "body": "Hi HR Team,\n\nI confirm the meeting has been rescheduled to Saturday, May 23, 2026, 10:00 AM - 11:00 AM in Conference Room B.\n\nBest regards,\nPeter Griffin",
    "send_now": true
  }'

echo "All tasks complete"
