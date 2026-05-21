#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:1235"
COOKIE_JAR="/tmp/finance_cookies.txt"

# 1. Login
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' > /dev/null

# 2. Get all transactions and review
curl -s -b "$COOKIE_JAR" "$BASE_URL/api/transactions" > /tmp/transactions.json

# 3. Flag anomalous transactions
# id=8:  Acme Corp $12,500.50 (duplicate of id=10)
curl -s -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/transactions/8/flag" \
  -H "Content-Type: application/json" > /dev/null

# id=9:  Stark Ind $50,000.00 (round-number anomaly)
curl -s -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/transactions/9/flag" \
  -H "Content-Type: application/json" > /dev/null

# id=10: Acme Corp $12,500.50 (duplicate of id=8)
curl -s -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/transactions/10/flag" \
  -H "Content-Type: application/json" > /dev/null

# id=11: Umbrella $100,000.00 (round-number anomaly)
curl -s -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/transactions/11/flag" \
  -H "Content-Type: application/json" > /dev/null
