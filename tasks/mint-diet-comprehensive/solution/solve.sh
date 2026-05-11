#!/usr/bin/env bash
set -euo pipefail

# Food Catalog ID Reference (based on mock-platform/mocks/mint-diet/src/seeds.ts insertion order)
# ZH foods (inserted first, IDs 1-15):
#   白米饭 = 1        (white rice)
#   鸡胸肉 = 6        (chicken breast)
#   三文鱼 = 7        (salmon)
#   牛奶 = 10         (milk)
#   燕麦 = 12         (oatmeal - ZH)
#   香蕉 = 13         (banana - ZH)
# EN foods (inserted second, IDs 16-30):
#   oatmeal = 16
#   chicken breast = 18
#   salmon = 19
#   milk = 23
#   banana = 24
#   broccoli = 30
#
# Note: These IDs depend on seed order in seeds.ts. If seeds.ts changes, IDs may need updating.

BASE_URL="http://localhost:5003"

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
# Breakfast: oatmeal 250g (ID 16), banana 120g (ID 24)
echo "Logging breakfast..."
curl -sf -X POST "${BASE_URL}/log/${TODAY}/entries" \
  -d "slot=breakfast" \
  -d "food_catalog_id=16" \
  -d "food_name=oatmeal" \
  -d "quantity_value=250" \
  -d "quantity_unit=g" \
  -d "calories_kcal=950" \
  -d "protein_g=31.25" \
  -d "carbs_g=168.75" \
  -d "fat_g=15.625" \
  -o /dev/null

curl -sf -X POST "${BASE_URL}/log/${TODAY}/entries" \
  -d "slot=breakfast" \
  -d "food_catalog_id=24" \
  -d "food_name=banana" \
  -d "quantity_value=120" \
  -d "quantity_unit=g" \
  -d "calories_kcal=107" \
  -d "protein_g=1.3" \
  -d "carbs_g=27.1" \
  -d "fat_g=0.4" \
  -o /dev/null

# Lunch: chicken breast 200g (ID 18), white rice 300g (ID 1)
echo "Logging lunch..."
curl -sf -X POST "${BASE_URL}/log/${TODAY}/entries" \
  -d "slot=lunch" \
  -d "food_catalog_id=18" \
  -d "food_name=chicken breast" \
  -d "quantity_value=200" \
  -d "quantity_unit=g" \
  -d "calories_kcal=260" \
  -d "protein_g=48" \
  -d "carbs_g=0" \
  -d "fat_g=6" \
  -o /dev/null

curl -sf -X POST "${BASE_URL}/log/${TODAY}/entries" \
  -d "slot=lunch" \
  -d "food_catalog_id=1" \
  -d "food_name=white rice" \
  -d "quantity_value=300" \
  -d "quantity_unit=g" \
  -d "calories_kcal=390" \
  -d "protein_g=7.2" \
  -d "carbs_g=86.4" \
  -d "fat_g=0.6" \
  -o /dev/null

# Dinner: salmon 150g (ID 19), broccoli 100g (ID 30)
echo "Logging dinner..."
curl -sf -X POST "${BASE_URL}/log/${TODAY}/entries" \
  -d "slot=dinner" \
  -d "food_catalog_id=19" \
  -d "food_name=salmon" \
  -d "quantity_value=150" \
  -d "quantity_unit=g" \
  -d "calories_kcal=312" \
  -d "protein_g=30" \
  -d "carbs_g=0" \
  -d "fat_g=19.5" \
  -o /dev/null

curl -sf -X POST "${BASE_URL}/log/${TODAY}/entries" \
  -d "slot=dinner" \
  -d "food_catalog_id=30" \
  -d "food_name=broccoli" \
  -d "quantity_value=100" \
  -d "quantity_unit=g" \
  -d "calories_kcal=34" \
  -d "protein_g=2.8" \
  -d "carbs_g=6.6" \
  -d "fat_g=0.4" \
  -o /dev/null

# Snack: milk 240ml (ID 23)
echo "Logging snack..."
curl -sf -X POST "${BASE_URL}/log/${TODAY}/entries" \
  -d "slot=snacks" \
  -d "food_catalog_id=23" \
  -d "food_name=milk" \
  -d "quantity_value=240" \
  -d "quantity_unit=ml" \
  -d "calories_kcal=149" \
  -d "protein_g=8" \
  -d "carbs_g=11.7" \
  -d "fat_g=8" \
  -o /dev/null

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
