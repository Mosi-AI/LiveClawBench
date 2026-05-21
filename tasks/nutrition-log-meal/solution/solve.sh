#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:5003"

# Wait for health check
for _ in $(seq 1 30); do
  if curl -sf "${BASE_URL}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Get today's date (YYYY-MM-DD)
TODAY=$(date +%Y-%m-%d)

# Step 1: Search for milk in the catalog
SEARCH_RESPONSE=$(curl -sf "${BASE_URL}/log/${TODAY}/add/lunch?q=milk" 2>/dev/null || echo "")

# Step 2: Parse HTML to find the milk entry ID (English "milk", not "牛奶")
# Look for radio input with value="<id>" and corresponding label containing "milk"
MILK_ID=$(echo "$SEARCH_RESPONSE" | grep -oP 'value="\K[0-9]+' | head -1 || echo "")

# If we can't parse the ID, try a different approach - search for milk entry with English name
if [ -z "$MILK_ID" ]; then
  # Fallback: try to get the first numeric ID from the search results
  MILK_ID=$(echo "$SEARCH_RESPONSE" | grep -oP '\bid=\K[0-9]+' | head -1 || echo "")
fi

if [ -n "$MILK_ID" ]; then
  # Log milk via catalog entry (using English "milk")
  curl -sf -X POST "${BASE_URL}/log/${TODAY}/entries" \
    -d "slot=lunch" \
    -d "food_catalog_id=${MILK_ID}" \
    -d "food_name=milk" \
    -d "quantity_value=240" \
    -d "quantity_unit=ml" \
    -o /dev/null
else
  # Fallback: log milk manually if catalog lookup fails
  curl -sf -X POST "${BASE_URL}/log/${TODAY}/entries" \
    -d "slot=lunch" \
    -d "food_name=milk" \
    -d "quantity_value=240" \
    -d "quantity_unit=ml" \
    -d "calories_kcal=149" \
    -d "protein_g=8.0" \
    -d "carbs_g=11.7" \
    -d "fat_g=8.0" \
    -o /dev/null
fi

# Step 3: Log chicken salad manually (not in catalog)
curl -sf -X POST "${BASE_URL}/log/${TODAY}/entries" \
  -d "slot=lunch" \
  -d "food_name=chicken salad" \
  -d "quantity_value=1" \
  -d "quantity_unit=份" \
  -o /dev/null
