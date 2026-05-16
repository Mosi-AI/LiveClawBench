#!/usr/bin/env bash
set -euo pipefail

HEALTH_API="http://localhost:5007"
CALENDAR_API="http://localhost:5006"
EMAIL="peter.griffin@work.mosi.inc"
PASSWORD="password123"

# Login to health portal
HEALTH_LOGIN=$(curl -s -X POST "${HEALTH_API}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")
HEALTH_TOKEN=$(echo "$HEALTH_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

# Archive old medications
for MED_ID in 100 101; do
    curl -s -X DELETE "${HEALTH_API}/api/medications/${MED_ID}" \
      -H "Authorization: Bearer ${HEALTH_TOKEN}" > /dev/null
done
echo "Archived old medications"

# Create new Metformin medication
curl -s -X POST "${HEALTH_API}/api/medications" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${HEALTH_TOKEN}" \
  -d '{
    "name": "Metformin",
    "display_name": "Metformin 500mg",
    "frequency": "daily",
    "dose_amount": 500,
    "dose_unit": "mg",
    "start_date": "2026-05-16",
    "notes": "Take twice daily with meals",
    "intake_slots": [{"time_hhmm": "08:00"}, {"time_hhmm": "18:00"}]
  }' > /dev/null
echo "Created Metformin medication"

# Login to calendar
curl -s -c /tmp/cal_cookie -X POST "${CALENDAR_API}/login" \
  -d "email=${EMAIL}&password=${PASSWORD}" -L > /dev/null

# Delete stale calendar reminders
EVENTS=$(curl -s -b /tmp/cal_cookie "${CALENDAR_API}/api/events")
for TITLE in "Glipizide" "Acarbose"; do
    EID=$(echo "$EVENTS" | python3 -c "import sys,json; [print(e['id']) for e in json.load(sys.stdin).get('events',[]) if '$TITLE' in e.get('title','')]" 2>/dev/null || true)
    for id in $EID; do
        curl -s -b /tmp/cal_cookie -X DELETE "${CALENDAR_API}/api/events/${id}" > /dev/null
    done
done
echo "Cleaned up stale reminders"

# Create new calendar events for Metformin
curl -s -b /tmp/cal_cookie -X POST "${CALENDAR_API}/api/events" \
  -H "Content-Type: application/json" \
  -d '{"title":"Take Metformin 500mg","description":"Morning dose with breakfast","event_type":"medication","start_time":"2026-05-17T08:00:00Z","end_time":"2026-05-17T08:15:00Z"}' > /dev/null

curl -s -b /tmp/cal_cookie -X POST "${CALENDAR_API}/api/events" \
  -H "Content-Type: application/json" \
  -d '{"title":"Take Metformin 500mg","description":"Evening dose with dinner","event_type":"medication","start_time":"2026-05-17T18:00:00Z","end_time":"2026-05-17T18:15:00Z"}' > /dev/null
echo "Created new medication calendar events"

echo "All tasks complete"
