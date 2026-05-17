#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:5003"

find_catalog_id() {
  local date="$1"
  local slot="$2"
  local query="$3"
  local response
  response=$(curl -sfG --data-urlencode "q=${query}" "${BASE_URL}/log/${date}/add/${slot}" 2>/dev/null || echo "")
  echo "$response" | grep -oP 'food=\K[0-9]+' | head -1 || true
}

add_catalog_entry() {
  local date="$1"
  local slot="$2"
  local search_query="$3"
  local food_name="$4"
  local quantity_value="$5"
  local quantity_unit="$6"
  local catalog_id

  catalog_id=$(find_catalog_id "$date" "$slot" "$search_query")
  if [ -z "$catalog_id" ]; then
    echo "Could not find catalog food: ${search_query}" >&2
    exit 1
  fi

  curl -sf -X POST "${BASE_URL}/log/${date}/entries" \
    -d "slot=${slot}" \
    -d "food_catalog_id=${catalog_id}" \
    -d "food_name=${food_name}" \
    -d "quantity_value=${quantity_value}" \
    -d "quantity_unit=${quantity_unit}" \
    -o /dev/null
}

# Compute dates
TODAY=$(date +%Y-%m-%d)

# Compute next Monday: if today is Monday, we want next week's Monday (today + 7)
# Using the formula: days_to_add = (7 - weekday) % 7, then if 0 add 7
WEEKDAY=$(date +%u)  # 1=Monday, 7=Sunday
if [ "$WEEKDAY" -eq 1 ]; then
  # Today is Monday, go to next Monday
  DAYS_TO_MONDAY=7
else
  # Any other day, compute days until next Monday
  DAYS_TO_MONDAY=$((8 - WEEKDAY))
fi
NEXT_MONDAY=$(date -d "+${DAYS_TO_MONDAY} days" +%Y-%m-%d)
NEXT_TUESDAY=$(date -d "+${DAYS_TO_MONDAY} days +1 day" +%Y-%m-%d)
NEXT_SUNDAY=$(date -d "+${DAYS_TO_MONDAY} days +6 days" +%Y-%m-%d)

echo "Today: $TODAY"
echo "Next Monday: $NEXT_MONDAY"
echo "Next Tuesday: $NEXT_TUESDAY"
echo "Next Sunday: $NEXT_SUNDAY"

# Wait for mock health check
echo "Waiting for mock service..."
for _ in $(seq 1 30); do
  if curl -sf "${BASE_URL}/health" >/dev/null 2>&1; then
    echo "Mock service is ready"
    break
  fi
  sleep 1
done

# Step 1: Log meals for today
echo "Logging breakfast..."
add_catalog_entry "$TODAY" "breakfast" "oatmeal" "oatmeal" "250" "g"
add_catalog_entry "$TODAY" "breakfast" "banana" "banana" "120" "g"

echo "Logging lunch..."
add_catalog_entry "$TODAY" "lunch" "chicken breast" "chicken breast" "200" "g"
add_catalog_entry "$TODAY" "lunch" "白米饭" "white rice" "300" "g"

echo "Logging dinner..."
add_catalog_entry "$TODAY" "dinner" "salmon" "salmon" "150" "g"
add_catalog_entry "$TODAY" "dinner" "broccoli" "broccoli" "100" "g"

echo "Logging snack..."
add_catalog_entry "$TODAY" "snacks" "milk" "milk" "240" "ml"

# Step 2: Create meal plan
echo "Creating meal plan..."
# First, create the plan and capture the redirect to get the plan ID
PLAN_RESPONSE=$(curl -sf -X POST "${BASE_URL}/plans" \
  -d "title=Clean Eating Week" \
  -d "start_date=${NEXT_MONDAY}" \
  -d "end_date=${NEXT_SUNDAY}" \
  -d "status=active" \
  -d "target_calories_kcal=1800" \
  -w "\n%{redirect_url}" \
  -o /dev/null)

# Extract plan ID from redirect URL (e.g., http://localhost:5003/plans/1)
PLAN_ID=$(echo "$PLAN_RESPONSE" | grep -oE '[0-9]+$')
echo "Created plan with ID: $PLAN_ID"

# Step 3: Add Monday plan items
echo "Adding Monday plan items..."
curl -sf -X POST "${BASE_URL}/plans/${PLAN_ID}/items" \
  -d "plan_date=${NEXT_MONDAY}" \
  -d "meal_slot=breakfast" \
  -d "dish_name=Oatmeal with banana" \
  -o /dev/null

curl -sf -X POST "${BASE_URL}/plans/${PLAN_ID}/items" \
  -d "plan_date=${NEXT_MONDAY}" \
  -d "meal_slot=lunch" \
  -d "dish_name=Chicken breast with rice" \
  -o /dev/null

curl -sf -X POST "${BASE_URL}/plans/${PLAN_ID}/items" \
  -d "plan_date=${NEXT_MONDAY}" \
  -d "meal_slot=dinner" \
  -d "dish_name=Salmon with broccoli" \
  -o /dev/null

# Step 4: Add Tuesday plan items
echo "Adding Tuesday plan items..."
curl -sf -X POST "${BASE_URL}/plans/${PLAN_ID}/items" \
  -d "plan_date=${NEXT_TUESDAY}" \
  -d "meal_slot=breakfast" \
  -d "dish_name=Scrambled eggs with whole wheat toast" \
  -o /dev/null

curl -sf -X POST "${BASE_URL}/plans/${PLAN_ID}/items" \
  -d "plan_date=${NEXT_TUESDAY}" \
  -d "meal_slot=lunch" \
  -d "dish_name=Tuna salad" \
  -o /dev/null

curl -sf -X POST "${BASE_URL}/plans/${PLAN_ID}/items" \
  -d "plan_date=${NEXT_TUESDAY}" \
  -d "meal_slot=dinner" \
  -d "dish_name=Stir-fried tofu with vegetables" \
  -o /dev/null

# Step 5: Update plan notes (must preserve all other fields)
echo "Updating plan notes..."
curl -sf -X POST "${BASE_URL}/plans/${PLAN_ID}" \
  -d "title=Clean Eating Week" \
  -d "start_date=${NEXT_MONDAY}" \
  -d "end_date=${NEXT_SUNDAY}" \
  -d "status=active" \
  -d "target_calories_kcal=1800" \
  -d "notes=Focus on lean protein and vegetables — no fried foods." \
  -o /dev/null

echo "All done!"
