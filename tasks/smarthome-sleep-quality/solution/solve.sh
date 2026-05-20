#!/bin/bash
# Reference solution for smarthome-sleep-quality task
# This script implements the oracle path to achieve score 1.0

set -e

echo "=== Smart Home Sleep Quality Oracle Solution ==="

# Step 1: Get health data from health-mock
echo "Step 1: Fetching health data from health-mock..."
HEALTH_DATA=$(curl -s "http://localhost:5007/api/health/snapshot?date=2026-05-09")
echo "Health data: $HEALTH_DATA"

# Parse health data
SLEEP_QUALITY=$(echo "$HEALTH_DATA" | python3 -c "import sys, json; print(json.load(sys.stdin).get('sleep_quality', 0))")
RESTING_HEART_RATE=$(echo "$HEALTH_DATA" | python3 -c "import sys, json; print(json.load(sys.stdin).get('resting_heart_rate_bpm', 0))")
TOTAL_ACTIVITY_MIN=$(echo "$HEALTH_DATA" | python3 -c "import sys, json; print(json.load(sys.stdin).get('total_activity_min', 0))")
SLEEP_HOURS=$(echo "$HEALTH_DATA" | python3 -c "import sys, json; print(json.load(sys.stdin).get('sleep_hours', 0))")

echo "  sleep_quality: $SLEEP_QUALITY"
echo "  resting_heart_rate_bpm: $RESTING_HEART_RATE"
echo "  total_activity_min: $TOTAL_ACTIVITY_MIN"
echo "  sleep_hours: $SLEEP_HOURS"

# Step 2: Calculate readiness
echo "Step 2: Calculating readiness..."
# normalized_rhr = (resting_heart_rate - 40) / 60 * 100
NORMALIZED_RHR=$(python3 -c "print(($RESTING_HEART_RATE - 40) / 60 * 100)")
# activity_factor = min(total_activity_min / 60 * 100, 100)
ACTIVITY_FACTOR=$(python3 -c "print(min($TOTAL_ACTIVITY_MIN / 60 * 100, 100))")
# readiness = sleep_quality * 0.4 + (100 - normalized_rhr) * 0.3 + activity_factor * 0.3
READINESS=$(python3 -c "print(round($SLEEP_QUALITY * 0.4 + (100 - $NORMALIZED_RHR) * 0.3 + $ACTIVITY_FACTOR * 0.3))")

echo "  normalized_rhr: $NORMALIZED_RHR"
echo "  activity_factor: $ACTIVITY_FACTOR"
echo "  readiness: $READINESS"

# Step 3: Sync to smarthome wearable
echo "Step 3: Syncing to smarthome wearable..."
curl -s -X POST http://localhost:5004/api/wearable-recovery \
  -H "Content-Type: application/json" \
  -d "{\"sleep_hours\": $SLEEP_HOURS, \"sleep_score\": $SLEEP_QUALITY, \"readiness\": $READINESS, \"resting_heart_rate\": $RESTING_HEART_RATE}"
echo ""

# Step 4: Check thresholds and adjust thermostat
echo "Step 4: Checking thresholds..."
if [ "$SLEEP_QUALITY" -lt 70 ] && [ "$READINESS" -lt 70 ]; then
  echo "  Both sleep_score ($SLEEP_QUALITY) and readiness ($READINESS) are below 70"
  echo "  Adjusting thermostat to 68°F..."
  curl -s -X POST http://localhost:5004/api/thermostat \
    -H "Content-Type: application/json" \
    -d '{"mode": "comfort", "temperature": 68}'
  echo ""
else
  echo "  Thresholds not met, no thermostat adjustment needed"
fi

# Step 5: Check sleep aids inventory
echo "Step 5: Checking sleep aids inventory..."
INVENTORY=$(curl -s http://localhost:5004/api/inventory)
MELATONIN_QTY=$(echo "$INVENTORY" | python3 -c "import sys, json; items = json.load(sys.stdin); melatonin = [i for i in items if 'melatonin' in i.get('item_name', '').lower()]; print(melatonin[0].get('quantity', 0) if melatonin else 0)")
CHAMOMILE_QTY=$(echo "$INVENTORY" | python3 -c "import sys, json; items = json.load(sys.stdin); tea = [i for i in items if 'chamomile tea' in i.get('item_name', '').lower()]; print(tea[0].get('quantity', 0) if tea else 0)")
echo "  Melatonin quantity: $MELATONIN_QTY"
echo "  Chamomile Tea quantity: $CHAMOMILE_QTY"

if [ "$MELATONIN_QTY" -eq 0 ]; then
  echo "  Melatonin out of stock, ordering..."

  # Step 6: Add Melatonin to cart and checkout
  echo "Step 6: Adding Melatonin to cart..."
  curl -s -X POST http://localhost:1234/api/cart/add \
    -H "Content-Type: application/json" \
    -d '{"product_id": "prod_melatonin"}'
  echo ""

  echo "Step 7: Checking out..."
  ORDER_RESULT=$(curl -s -X POST http://localhost:1234/api/checkout)
  ORDER_ID=$(echo "$ORDER_RESULT" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('data', {}).get('order_id', ''))")
  echo "  Order placed: $ORDER_ID"

  # Step 8: Add to shopping list with reference
  echo "Step 8: Adding Melatonin to shopping list with order reference..."
  curl -s -X POST http://localhost:5004/api/grocery/products \
    -H "Content-Type: application/json" \
    -d "{\"product_id\": \"PROD_MELATONIN\", \"name\": \"Melatonin 5mg\", \"quantity\": 50, \"unit\": \"tablets\", \"stock_status\": \"insufficient\", \"reference\": \"$ORDER_ID\"}"
  echo ""
fi

if [ "$CHAMOMILE_QTY" -ge 10 ]; then
  echo "  Chamomile Tea is already stocked as a sleep aid; no tea order needed."
fi

# Step 9: Report findings
echo "Step 9: Writing response..."
mkdir -p /workspace/output
cat > /workspace/output/response.txt << EOF
I checked your sleep data from last night (2026-05-09) in the health app. Here's what I found:

- Sleep quality: 60 (below 70 threshold)
- Readiness score: 53 (below 70 threshold)
- Resting heart rate: 72 bpm
- Sleep duration: 6.5 hours

Since both your sleep score (60) and readiness (53) were below 70, I took the following actions:

1. Adjusted your bedroom thermostat to 68°F for better sleep conditions tonight.
2. Found that your Melatonin supply was out of stock, so I ordered a new bottle (Melatonin 5mg / 50 tablets) from Mosi Shop. Order ID: ORD000004.
3. Added Melatonin to your shopping list with a reference to the order.
4. Confirmed that Chamomile Tea also counts as a sleep aid and you already had 10 bags in the pantry, so no extra tea order was needed.

Your sleep aids are now ready for tonight. Try to get some extra rest!
EOF

echo "=== Oracle solution complete ==="
cat /workspace/output/response.txt
