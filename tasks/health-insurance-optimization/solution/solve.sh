#!/usr/bin/env bash
set -euo pipefail

INSURANCE_API="http://localhost:6000"
CALENDAR_API="http://localhost:5003"
EMAIL="peter.griffin@work.mosi.inc"
PASSWORD="password123"

# ============================================================================
# Part 1: Insurance — login
# ============================================================================

echo "[Insurance] Logging in as ${EMAIL}..."
LOGIN_RESPONSE=$(curl -s -X POST "${INSURANCE_API}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(echo "${LOGIN_RESPONSE}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
if [ -z "${TOKEN}" ]; then
  echo "FAIL: Insurance login failed"
  echo "Response: ${LOGIN_RESPONSE}"
  exit 1
fi
echo "[Insurance] Login successful"

# ============================================================================
# Part 2: Insurance — submit reimbursement claim
# ============================================================================

echo "[Insurance] Submitting reimbursement claim..."
CLAIM_RESPONSE=$(curl -s -X POST "${INSURANCE_API}/api/claims" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "claim_type": "reimbursement",
    "total_amount": 25000,
    "service_date": "2026-05-10",
    "provider_name": "Metro Lab Services",
    "check_item": "lab",
    "notes": "Annual blood work follow-up"
  }')

CLAIM_ERROR=$(echo "${CLAIM_RESPONSE}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',''))" || true)
if [ -n "${CLAIM_ERROR}" ]; then
  echo "FAIL: Claim submission failed — ${CLAIM_ERROR}"
  exit 1
fi
echo "[Insurance] Claim submitted successfully"

# ============================================================================
# Part 3: Insurance — find and book Blood Test at Metro Lab Services
# ============================================================================

echo "[Insurance] Searching for Blood Test provider..."
PROVIDERS_RESPONSE=$(curl -s "${INSURANCE_API}/api/providers?check_item=lab" \
  -H "Authorization: Bearer ${TOKEN}")

# Find Metro Lab Services' Blood Test service
BLOOD_SERVICE=$(echo "${PROVIDERS_RESPONSE}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data.get('providers', []):
    if p.get('name') == 'Metro Lab Services':
        for s in p.get('services', []):
            if s.get('service_name') == 'Blood Test':
                print(f\"{p['id']}:{s['id']}\")
                break
")

if [ -z "${BLOOD_SERVICE}" ]; then
  echo "FAIL: Could not find Blood Test at Metro Lab Services"
  exit 1
fi

BLOOD_PROVIDER_ID=$(echo "${BLOOD_SERVICE}" | cut -d: -f1)
BLOOD_SERVICE_ID=$(echo "${BLOOD_SERVICE}" | cut -d: -f2)
echo "[Insurance] Found Blood Test: provider=${BLOOD_PROVIDER_ID}, service=${BLOOD_SERVICE_ID}"

# Get available slots
SLOTS_RESPONSE=$(curl -s "${INSURANCE_API}/api/providers/${BLOOD_PROVIDER_ID}/services/${BLOOD_SERVICE_ID}/slots" \
  -H "Authorization: Bearer ${TOKEN}")

BLOOD_SLOT_ID=$(echo "${SLOTS_RESPONSE}" | python3 -c "
import sys, json
slots = json.load(sys.stdin).get('slots', [])
for s in slots:
    if s.get('is_available'):
        print(s.get('id', ''))
        break
")

if [ -z "${BLOOD_SLOT_ID}" ]; then
  echo "FAIL: No available Blood Test slots"
  exit 1
fi
echo "[Insurance] Found Blood Test slot id=${BLOOD_SLOT_ID}"

# Book Blood Test appointment
echo "[Insurance] Booking Blood Test appointment..."
BLOOD_APPT_RESPONSE=$(curl -s -X POST "${INSURANCE_API}/api/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"slot_id\": ${BLOOD_SLOT_ID}}")

BLOOD_APPT_ERROR=$(echo "${BLOOD_APPT_RESPONSE}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',''))" || true)
if [ -n "${BLOOD_APPT_ERROR}" ]; then
  echo "FAIL: Blood Test booking failed — ${BLOOD_APPT_ERROR}"
  exit 1
fi

# Extract the booked appointment times for calendar events
BLOOD_APPT_START=$(echo "${BLOOD_APPT_RESPONSE}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('slot_start_time', ''))
")
BLOOD_APPT_END=$(echo "${BLOOD_APPT_RESPONSE}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('slot_end_time', ''))
")
echo "[Insurance] Blood Test booked at ${BLOOD_APPT_START} - ${BLOOD_APPT_END}"

# ============================================================================
# Part 4: Insurance — find and book Diet Consultation at Nutrition & Wellness
# ============================================================================

echo "[Insurance] Searching for Diet Consultation provider..."
DIET_PROVIDERS=$(curl -s "${INSURANCE_API}/api/providers?check_item=specialist" \
  -H "Authorization: Bearer ${TOKEN}")

DIET_SERVICE=$(echo "${DIET_PROVIDERS}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data.get('providers', []):
    if p.get('name') == 'Nutrition & Wellness Center':
        for s in p.get('services', []):
            if s.get('service_name') == 'Diet Consultation':
                print(f\"{p['id']}:{s['id']}\")
                break
")

if [ -z "${DIET_SERVICE}" ]; then
  echo "FAIL: Could not find Diet Consultation at Nutrition & Wellness Center"
  exit 1
fi

DIET_PROVIDER_ID=$(echo "${DIET_SERVICE}" | cut -d: -f1)
DIET_SERVICE_ID=$(echo "${DIET_SERVICE}" | cut -d: -f2)
echo "[Insurance] Found Diet Consultation: provider=${DIET_PROVIDER_ID}, service=${DIET_SERVICE_ID}"

# Get available slots
DIET_SLOTS_RESPONSE=$(curl -s "${INSURANCE_API}/api/providers/${DIET_PROVIDER_ID}/services/${DIET_SERVICE_ID}/slots" \
  -H "Authorization: Bearer ${TOKEN}")

DIET_SLOT_ID=$(echo "${DIET_SLOTS_RESPONSE}" | python3 -c "
import sys, json
slots = json.load(sys.stdin).get('slots', [])
for s in slots:
    if s.get('is_available'):
        print(s.get('id', ''))
        break
")

if [ -z "${DIET_SLOT_ID}" ]; then
  echo "FAIL: No available Diet Consultation slots"
  exit 1
fi
echo "[Insurance] Found Diet Consultation slot id=${DIET_SLOT_ID}"

# Book Diet Consultation appointment
echo "[Insurance] Booking Diet Consultation appointment..."
DIET_APPT_RESPONSE=$(curl -s -X POST "${INSURANCE_API}/api/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"slot_id\": ${DIET_SLOT_ID}}")

DIET_APPT_ERROR=$(echo "${DIET_APPT_RESPONSE}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',''))" || true)
if [ -n "${DIET_APPT_ERROR}" ]; then
  echo "FAIL: Diet Consultation booking failed — ${DIET_APPT_ERROR}"
  exit 1
fi

DIET_APPT_START=$(echo "${DIET_APPT_RESPONSE}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('slot_start_time', ''))
")
DIET_APPT_END=$(echo "${DIET_APPT_RESPONSE}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('slot_end_time', ''))
")
echo "[Insurance] Diet Consultation booked at ${DIET_APPT_START} - ${DIET_APPT_END}"

# ============================================================================
# Part 5: Calendar — create two events matching booked appointment times
# ============================================================================

echo "[Calendar] Creating Blood Test calendar event..."
BLOOD_CAL_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${CALENDAR_API}/api/events" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": 1,
    \"title\": \"Blood Test\",
    \"start_time\": \"${BLOOD_APPT_START}\",
    \"end_time\": \"${BLOOD_APPT_END}\"
  }")

BLOOD_CAL_STATUS=$(echo "${BLOOD_CAL_RESPONSE}" | tail -1)
if [ "${BLOOD_CAL_STATUS}" != "201" ] && [ "${BLOOD_CAL_STATUS}" != "200" ]; then
  echo "FAIL: Blood Test calendar event creation returned ${BLOOD_CAL_STATUS}"
  echo "Response: ${BLOOD_CAL_RESPONSE}"
  exit 1
fi
echo "[Calendar] Blood Test event created"

echo "[Calendar] Creating Diet Consultation calendar event..."
DIET_CAL_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${CALENDAR_API}/api/events" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": 1,
    \"title\": \"Diet Consultation\",
    \"start_time\": \"${DIET_APPT_START}\",
    \"end_time\": \"${DIET_APPT_END}\"
  }")

DIET_CAL_STATUS=$(echo "${DIET_CAL_RESPONSE}" | tail -1)
if [ "${DIET_CAL_STATUS}" != "201" ] && [ "${DIET_CAL_STATUS}" != "200" ]; then
  echo "FAIL: Diet Consultation calendar event creation returned ${DIET_CAL_STATUS}"
  echo "Response: ${DIET_CAL_RESPONSE}"
  exit 1
fi
echo "[Calendar] Diet Consultation event created"

echo ""
echo "=== All tasks complete ==="
echo "1. Submitted reimbursement claim for \$250.00"
echo "2. Booked Blood Test appointment"
echo "3. Booked Diet Consultation appointment"
echo "4. Created two non-overlapping calendar events"
