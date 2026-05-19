#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:1235"
COOKIE_JAR="/tmp/finance_cookies.txt"

# 1. Login
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' > /dev/null

# 2. Get accounts and flag ACC-1002 (id=2, diff=$500 > $400)
curl -s -b "$COOKIE_JAR" "$BASE_URL/api/accounts" > /dev/null
curl -s -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/accounts/2/flag" \
  -H "Content-Type: application/json" > /dev/null

# 3. Get pending transactions and flag high-value ones (ids 2, 4, 8)
# id=2 Globex $52,000
curl -s -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/transactions/2/flag" \
  -H "Content-Type: application/json" > /dev/null
# id=4 Hooli $78,000
curl -s -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/transactions/4/flag" \
  -H "Content-Type: application/json" > /dev/null
# id=8 Cyberdyne $67,000
curl -s -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/transactions/8/flag" \
  -H "Content-Type: application/json" > /dev/null

# 4. Create expense report
REPORT_RESP=$(curl -s -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/expense-reports" \
  -H "Content-Type: application/json" \
  -d '{"trip_name":"March Marketing Trip","items":[{"expense_category":"flight","amount":1200},{"expense_category":"hotel","amount":900},{"expense_category":"meals","amount":350}]}')
REPORT_ID=$(echo "$REPORT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# 5. Submit expense report
curl -s -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/expense-reports/$REPORT_ID/submit" \
  -H "Content-Type: application/json" > /dev/null

# 6. Get vendors to find Globex Systems (vendor_id=2)
curl -s -b "$COOKIE_JAR" "$BASE_URL/api/vendors" > /dev/null

# 7. Create invoice
curl -s -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/invoices" \
  -H "Content-Type: application/json" \
  -d '{"vendor_id":2,"invoice_number":"INV-2026-004","invoice_date":"2026-03-01","items":[{"description":"Travel Expenses","category_code":"5100","amount":5000},{"description":"Consulting","category_code":"5400","amount":3000}]}' > /dev/null
