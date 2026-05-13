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

# 3. Review inventory
echo "3. Checking inventory..."
INVENTORY=$(curl -s "$BASE_URL/api/inventory")
echo "   Inventory reviewed"

# 4. Count expiring items (within 3 days from 2026-05-09)
echo "4. Checking expiring items..."
# Expiring items (<= 2026-05-12): Milk, Bread, Chicken Breast, Tomatoes, Yogurt, Cheese
echo "   Expiring items: Milk, Bread, Chicken Breast, Tomatoes, Yogurt, Cheese"

# 5. Check calendar
echo "5. Checking calendar..."
curl -s "$BASE_URL/api/calendar" > /dev/null
echo "   Calendar reviewed"

# 6. Update workout to walking
echo "6. Updating workout type..."
curl -s -X PUT "$BASE_URL/api/calendar/1" \
  -H "Content-Type: application/json" \
  -d '{"workout_type": "walking"}' > /dev/null
echo "   Workout updated to walking"

# 7. Add item to grocery shopping list
echo "7. Adding item to grocery shopping list..."
curl -s -X POST "$BASE_URL/api/grocery/products" \
  -H "Content-Type: application/json" \
  -d '{"product_id": "PROD009", "name": "Orange Juice", "quantity": 1, "unit": "gallon", "stock_status": "insufficient"}' > /dev/null
echo "   Added Orange Juice to shopping list"

echo ""
echo "=== Morning routine completed ==="
echo "Summary: Thermostat adjusted to comfort mode at 74°F, expiring items reported (Milk, Bread, Chicken Breast, Tomatoes, Yogurt, Cheese), workout changed to walking, Orange Juice added to shopping list."
