#!/usr/bin/env bash
set -euo pipefail

CALENDAR_API="http://localhost:5006"
EMAIL="peter.griffin@work.mosi.inc"
PASSWORD="password123"

# Login to calendar
curl -s -c /tmp/cal_cookie -X POST "${CALENDAR_API}/login" \
  -d "email=${EMAIL}&password=${PASSWORD}" -L > /dev/null

# Create interview event
curl -s -b /tmp/cal_cookie -X POST "${CALENDAR_API}/api/events" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Interview - Alex Thompson (Senior Developer)",
    "description": "Senior Developer candidate interview in Conference Room A",
    "event_type": "appointment",
    "start_time": "2026-05-26T14:00:00Z",
    "end_time": "2026-05-26T15:00:00Z"
  }'

echo "Created interview calendar event"

# Login to email
curl -s -c /tmp/email_cookie -X POST "http://localhost:5001/login" \
  -d "email=${EMAIL}&password=${PASSWORD}" -L > /dev/null

# Send confirmation email to HR
curl -s -b /tmp/email_cookie -X POST "http://localhost:5001/api/emails" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "hr@work.mosi.inc",
    "subject": "Re: Interview Confirmation - Senior Developer Candidate",
    "body": "Hi HR Team,\n\nI have added the interview for Alex Thompson (Senior Developer) to my calendar:\n- Date: Monday, May 26, 2026\n- Time: 2:00 PM - 3:00 PM\n- Location: Conference Room A\n\nConfirmed.\n\nBest regards,\nPeter Griffin"
  }'

echo "All tasks complete"
