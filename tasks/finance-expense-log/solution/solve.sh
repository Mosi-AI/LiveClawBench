#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:1235"
COOKIE_JAR="/tmp/finance_cookies.txt"

# 1. Login
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' > /dev/null

# 2. Create expense report with all items
# Category mapping from natural language descriptions:
#   "Taxi from airport to hotel"       -> transport
#   "Team lunch at Italian place"      -> meals
#   "Uber to client meeting"           -> transport
#   "Flight to New York"               -> flight
#   "Marriott downtown for 3 nights"   -> hotel
REPORT_RESP=$(curl -s -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/expense-reports" \
  -H "Content-Type: application/json" \
  -d '{"trip_name":"NYC Client Visit","items":[{"expense_category":"transport","amount":45.00},{"expense_category":"meals","amount":85.50},{"expense_category":"transport","amount":32.00},{"expense_category":"flight","amount":450.00},{"expense_category":"hotel","amount":750.00}]}')
REPORT_ID=$(echo "$REPORT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# 3. Submit expense report
curl -s -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/expense-reports/$REPORT_ID/submit" \
  -H "Content-Type: application/json" > /dev/null
