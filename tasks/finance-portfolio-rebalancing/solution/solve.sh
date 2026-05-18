#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:1235"
COOKIE_JAR="/tmp/finance_cookies.txt"

# 1. Login
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' > /dev/null

# 2. Get current portfolio (for reference)
curl -s -b "$COOKIE_JAR" "$BASE_URL/api/portfolio" > /dev/null

# 3. Place orders to rebalance
# Total = $250,000
# eq target = 45% = $112,500 (buy $12,500)
# fi target = 30% = $75,000 (sell $5,000)
# ca target = 15% = $37,500 (sell $12,500)
# al target = 10% = $25,000 (buy $5,000)

for payload in \
  '{"asset_class_code":"eq","direction":"buy","amount":12500}' \
  '{"asset_class_code":"fi","direction":"sell","amount":5000}' \
  '{"asset_class_code":"ca","direction":"sell","amount":12500}' \
  '{"asset_class_code":"al","direction":"buy","amount":5000}'; do
  curl -s -b "$COOKIE_JAR" \
    -X POST "$BASE_URL/api/portfolio/orders" \
    -H "Content-Type: application/json" \
    -d "$payload" > /dev/null
done

# 4. Verify final state
curl -s -b "$COOKIE_JAR" "$BASE_URL/api/portfolio" > /dev/null
