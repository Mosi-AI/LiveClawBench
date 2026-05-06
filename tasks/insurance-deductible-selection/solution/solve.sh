#!/usr/bin/env bash
set -euo pipefail

API_BASE="http://localhost:6000"
EMAIL="peter.griffin@work.mosi.inc"
PASSWORD="password123"

# 1. Log in and extract JWT token
echo "Logging in as ${EMAIL}..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_BASE}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(echo "${LOGIN_RESPONSE}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
if [ -z "${TOKEN}" ]; then
  echo "FAIL: Login failed — no token in response"
  echo "Response: ${LOGIN_RESPONSE}"
  exit 1
fi
echo "Login successful"

# 2. List plans and find Balanced Silver (code B)
echo "Fetching plan list..."
PLANS_RESPONSE=$(curl -s "${API_BASE}/api/plans" -H "Authorization: Bearer ${TOKEN}")
PLAN_ID=$(echo "${PLANS_RESPONSE}" | python3 -c "
import sys, json
plans = json.load(sys.stdin).get('plans', [])
for p in plans:
    if p.get('code') == 'B':
        print(p.get('id', ''))
        break
")

if [ -z "${PLAN_ID}" ]; then
  echo "FAIL: Could not find plan with code B"
  echo "Response: ${PLANS_RESPONSE}"
  exit 1
fi
echo "Found Balanced Silver plan id=${PLAN_ID}"

# 3. Select the plan
echo "Selecting plan..."
SELECT_RESPONSE=$(curl -s -X POST "${API_BASE}/api/plans/${PLAN_ID}/select" \
  -H "Authorization: Bearer ${TOKEN}")

# Check for error in response
ERROR_MSG=$(echo "${SELECT_RESPONSE}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',''))" || true)
if [ -n "${ERROR_MSG}" ]; then
  echo "FAIL: Plan selection failed — ${ERROR_MSG}"
  echo "Response: ${SELECT_RESPONSE}"
  exit 1
fi

echo "Plan selection successful"
echo "Response: ${SELECT_RESPONSE}"
