#!/usr/bin/env bash
set -euo pipefail

INSURANCE_API="http://localhost:5010"
CALENDAR_API="http://localhost:5006"
EMAIL="peter.griffin@work.mosi.inc"
PASSWORD="password123"

# Login to insurance
LOGIN_RESPONSE=$(curl -s -X POST "${INSURANCE_API}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")
TOKEN=$(echo "${LOGIN_RESPONSE}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

# Find existing appointments
APPOINTMENTS=$(curl -s "${INSURANCE_API}/api/appointments" -H "Authorization: Bearer ${TOKEN}")
echo "Current appointments: $APPOINTMENTS"

# Find out-of-network appointment and cancel it
OON_APPT_ID=$(echo "$APPOINTMENTS" | python3 -c "
import sys, json
for a in json.load(sys.stdin).get('appointments', []):
    if 'Out-of-Network' in a.get('provider_name', ''):
        print(a['id'])
        break
" || true)

if [ -n "$OON_APPT_ID" ]; then
    curl -s -X DELETE "${INSURANCE_API}/api/appointments/${OON_APPT_ID}" \
      -H "Authorization: Bearer ${TOKEN}"
    echo "Cancelled out-of-network appointment ${OON_APPT_ID}"
fi

# Find an in-network provider for general checkup
PROVIDERS=$(curl -s "${INSURANCE_API}/api/providers?check_item=general_checkup" \
  -H "Authorization: Bearer ${TOKEN}")

IN_NET_SERVICE=$(echo "$PROVIDERS" | python3 -c "
import sys, json
for p in json.load(sys.stdin).get('providers', []):
    if p.get('network_status') == 'in_network':
        for s in p.get('services', []):
            print(f\"{p['id']}:{s['id']}\")
            break
        break
")

if [ -z "$IN_NET_SERVICE" ]; then
    echo "FAIL: No in-network provider found"
    exit 1
fi

PROVIDER_ID=$(echo "$IN_NET_SERVICE" | cut -d: -f1)
SERVICE_ID=$(echo "$IN_NET_SERVICE" | cut -d: -f2)

# Get available slots
SLOTS=$(curl -s "${INSURANCE_API}/api/providers/${PROVIDER_ID}/services/${SERVICE_ID}/slots" \
  -H "Authorization: Bearer ${TOKEN}")
SLOT_ID=$(echo "$SLOTS" | python3 -c "
import sys, json
for s in json.load(sys.stdin).get('slots', []):
    if s.get('is_available'):
        print(s['id'])
        break
" || true)

if [ -z "$SLOT_ID" ]; then
    echo "FAIL: No available slot"
    exit 1
fi

# Book new appointment
APPT_RESPONSE=$(curl -s -X POST "${INSURANCE_API}/api/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"slot_id\": ${SLOT_ID}}")

APPT_START=$(echo "$APPT_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('slot_start_time',''))")
APPT_END=$(echo "$APPT_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('slot_end_time',''))")
echo "Booked in-network appointment at ${APPT_START} - ${APPT_END}"

# Login to calendar
curl -s -c /tmp/cal_cookie -X POST "${CALENDAR_API}/login" \
  -d "email=${EMAIL}&password=${PASSWORD}" -L > /dev/null

# Create calendar event matching the appointment
curl -s -b /tmp/cal_cookie -X POST "${CALENDAR_API}/api/events" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Health Checkup\",
    \"description\": \"In-network appointment\",
    \"event_type\": \"appointment\",
    \"start_time\": \"${APPT_START}\",
    \"end_time\": \"${APPT_END}\"
  }"

echo "All tasks complete"
