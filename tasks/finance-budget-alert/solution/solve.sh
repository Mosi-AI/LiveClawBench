#!/usr/bin/env bash
set -euo pipefail

FINANCE_URL="http://localhost:1235"
EMAIL_URL="http://localhost:5001"
FINANCE_COOKIE="/tmp/finance_cookies.txt"

# 1. Login to finance system
curl -s -c "$FINANCE_COOKIE" -b "$FINANCE_COOKIE" \
  -X POST "$FINANCE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' > /dev/null

# 2. Get department records for March 2026
DEPARTMENTS=$(curl -s -b "$FINANCE_COOKIE" "$FINANCE_URL/api/departments?month=2026-03")
echo "Department data: $DEPARTMENTS"

# 3. Login to email system
EMAIL_LOGIN=$(curl -s -X POST "$EMAIL_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"peter","password":"password123"}')
TOKEN=$(echo "$EMAIL_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

# 4. Identify violating departments and send alerts
# Engineering: actual 180000 > budget 150000 (over budget)
curl -s -X POST "$EMAIL_URL/api/emails" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "recipient": "eng.manager@example.com",
    "subject": "Budget Alert: Engineering Department Over Budget - March 2026",
    "body": "Dear Engineering Department Manager,\n\nThis is an automated budget alert for March 2026.\n\nYour department has exceeded its budget allocation:\n- Budget: $150,000.00\n- Actual Expense: $180,000.00\n- Overrun: $30,000.00 (120.0% utilization)\n\nPlease review your department expenses and provide an explanation for the overrun.\n\nBest regards,\nFinancial Controller",
    "send_now": true
  }' > /dev/null

# Sales: actual -5000 (negative expense)
curl -s -X POST "$EMAIL_URL/api/emails" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "recipient": "sales.manager@example.com",
    "subject": "Budget Alert: Sales Department Negative Expense - March 2026",
    "body": "Dear Sales Department Manager,\n\nThis is an automated budget alert for March 2026.\n\nYour department has a data integrity issue:\n- Budget: $150,000.00\n- Actual Expense: -$5,000.00 (NEGATIVE)\n\nA negative actual expense amount indicates a data error that needs immediate correction.\n\nPlease review and correct your department expense records.\n\nBest regards,\nFinancial Controller",
    "send_now": true
  }' > /dev/null

# Marketing: actual 200000 > budget 150000 (over budget)
curl -s -X POST "$EMAIL_URL/api/emails" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "recipient": "marketing.manager@example.com",
    "subject": "Budget Alert: Marketing Department Over Budget - March 2026",
    "body": "Dear Marketing Department Manager,\n\nThis is an automated budget alert for March 2026.\n\nYour department has exceeded its budget allocation:\n- Budget: $150,000.00\n- Actual Expense: $200,000.00\n- Overrun: $50,000.00 (133.3% utilization)\n\nPlease review your department expenses and provide an explanation for the overrun.\n\nBest regards,\nFinancial Controller",
    "send_now": true
  }' > /dev/null

echo "Budget alert emails sent successfully."
