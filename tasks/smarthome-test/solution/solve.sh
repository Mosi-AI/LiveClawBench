#!/bin/bash
# Reference solution for smarthome-test
# This script demonstrates how to complete the morning routine tasks

set -e

BASE_URL="http://localhost:5004"

echo "=== Smart Home Morning Routine Solution ==="

# 1. Check current status
echo "1. Checking dashboard..."
curl -s "$BASE_URL/" > /dev/null
echo "   Dashboard accessible"

# 2. Adjust thermostat to comfort mode at 74°F
echo "2. Adjusting thermostat..."
curl -s -X POST "$BASE_URL/api/thermostat" \
  -H "Content-Type: application/json" \
  -d '{"mode": "comfort", "temperature": 74}' > /dev/null
echo "   Thermostat set to comfort mode at 74°F"

# 3. Review inventory (implicit check)
echo "3. Checking inventory..."
curl -s "$BASE_URL/api/inventory" > /dev/null
echo "   Inventory reviewed"

# 4. Check calendar
echo "4. Checking calendar..."
curl -s "$BASE_URL/api/calendar" > /dev/null
echo "   Calendar reviewed"

# 5. Update workout to walking
echo "5. Updating workout type..."
curl -s -X PUT "$BASE_URL/api/calendar/1" \
  -H "Content-Type: application/json" \
  -d '{"workout_type": "walking"}' > /dev/null
echo "   Workout updated to walking"

# 6. Add item to grocery shopping list
echo "6. Adding item to grocery shopping list..."
curl -s -X POST "$BASE_URL/api/grocery/products" \
  -H "Content-Type: application/json" \
  -d '{"product_id": "PROD009", "name": "Orange Juice", "quantity": 1, "unit": "gallon", "stock_status": "insufficient"}' > /dev/null
echo "   Added Orange Juice to shopping list"

echo ""
echo "=== Morning routine completed ==="
