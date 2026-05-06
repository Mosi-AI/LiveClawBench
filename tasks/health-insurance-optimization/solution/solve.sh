#!/usr/bin/env bash
set -euo pipefail

INSURANCE_API="http://localhost:6000"
CALENDAR_API="http://localhost:5003"
EMAIL="peter.griffin@work.mosi.inc"
PASSWORD="password123"

# ============================================================================
# Part 1: Insurance — select Balanced Silver plan
# ============================================================================

# 1. Log in and extract JWT token
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

# 2. List plans and find Balanced Silver (code B)
echo "[Insurance] Fetching plan list..."
PLANS_RESPONSE=$(curl -s "${INSURANCE_API}/api/plans" -H "Authorization: Bearer ${TOKEN}")
PLAN_ID=$(echo "${PLANS_RESPONSE}" | python3 -c "
import sys, json
plans = json.load(sys.stdin).get('plans', [])
for p in plans:
    if p.get('code') == 'B':
        print(p.get('id', ''))
        break
")

if [ -z "${PLAN_ID}" ]; then
  echo "FAIL: Could not find Balanced Silver plan"
  exit 1
fi
echo "[Insurance] Found Balanced Silver plan id=${PLAN_ID}"

# 3. Select the plan
echo "[Insurance] Selecting plan..."
SELECT_RESPONSE=$(curl -s -X POST "${INSURANCE_API}/api/plans/${PLAN_ID}/select" \
  -H "Authorization: Bearer ${TOKEN}")

ERROR_MSG=$(echo "${SELECT_RESPONSE}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',''))" || true)
if [ -n "${ERROR_MSG}" ]; then
  echo "FAIL: Plan selection failed — ${ERROR_MSG}"
  exit 1
fi
echo "[Insurance] Plan selection successful"

# ============================================================================
# Part 2: Calendar — schedule Preventive Care appointment
# ============================================================================

echo "[Calendar] Scheduling Preventive Care appointment..."
CREATE_RESPONSE=$(curl -s -X POST "${CALENDAR_API}/api/events" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "title": "Preventive Care",
    "start_time": "2026-05-15T09:00:00Z",
    "end_time": "2026-05-15T10:00:00Z"
  }')

# Check for error
echo "[Calendar] Response: ${CREATE_RESPONSE}"
