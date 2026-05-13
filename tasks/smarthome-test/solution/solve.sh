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

# 6. Create 7-day meal plan
echo "6. Creating meal plan..."
curl -s -X POST "$BASE_URL/api/meal-plan" \
  -H "Content-Type: application/json" \
  -d '{
    "days": [
      {"date": "2026-05-09", "meals": [{"meal_type": "breakfast", "meal_id": 1}, {"meal_type": "lunch", "meal_id": 4}, {"meal_type": "dinner", "meal_id": 7}]},
      {"date": "2026-05-10", "meals": [{"meal_type": "breakfast", "meal_id": 2}, {"meal_type": "lunch", "meal_id": 5}, {"meal_type": "dinner", "meal_id": 8}]},
      {"date": "2026-05-11", "meals": [{"meal_type": "breakfast", "meal_id": 3}, {"meal_type": "lunch", "meal_id": 6}, {"meal_type": "dinner", "meal_id": 9}]},
      {"date": "2026-05-12", "meals": [{"meal_type": "breakfast", "meal_id": 1}, {"meal_type": "lunch", "meal_id": 4}, {"meal_type": "dinner", "meal_id": 10}]},
      {"date": "2026-05-13", "meals": [{"meal_type": "breakfast", "meal_id": 2}, {"meal_type": "lunch", "meal_id": 5}, {"meal_type": "dinner", "meal_id": 7}]},
      {"date": "2026-05-14", "meals": [{"meal_type": "breakfast", "meal_id": 3}, {"meal_type": "lunch", "meal_id": 6}, {"meal_type": "dinner", "meal_id": 8}]},
      {"date": "2026-05-15", "meals": [{"meal_type": "breakfast", "meal_id": 1}, {"meal_type": "lunch", "meal_id": 4}, {"meal_type": "dinner", "meal_id": 9}]}
    ]
  }' > /dev/null
echo "   Meal plan created"

# 7. Order groceries (milk and butter are low)
echo "7. Ordering groceries..."
curl -s -X POST "$BASE_URL/api/grocery/orders" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"product_id": "PROD001", "quantity": 2}, {"product_id": "PROD004", "quantity": 1}]}' > /dev/null
echo "   Grocery order placed"

echo ""
echo "=== Morning routine completed ==="
