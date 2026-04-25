#!/usr/bin/env bash
# See README.md § WAL verifier artifact contract
set -euo pipefail

BINARY="${1:-../../dist/mock-mint-diet}"
PORT="${2:-0}"

TMPDIR="$(mktemp -d)"
PID=""
trap 'kill "$PID" 2>/dev/null || true; rm -rf "$TMPDIR"' EXIT

# Pick a free port with bash-native $RANDOM (no python dependency).
# Retry up to 5 times; if a port is already bound the binary exits quickly
# and the health-check loop below catches it.
if [[ "$PORT" == "0" ]]; then
  for _attempt in 1 2 3 4 5; do
    PORT=$(( 32768 + (RANDOM % 28000) ))
    MOCK_DATA_DIR="$TMPDIR" "$BINARY" --port "$PORT" &>/tmp/mint-diet-smoke.log &
    PID=$!
    # Give it up to 6 s to bind
    _ready=0
    for _i in $(seq 1 30); do
      if curl -sf "http://localhost:$PORT/health" >/dev/null 2>&1; then
        _ready=1; break
      fi
      # If the process already died the port was taken; try a new one
      if ! kill -0 "$PID" 2>/dev/null; then break; fi
      sleep 0.2
    done
    if [[ $_ready -eq 1 ]]; then break; fi
    kill "$PID" 2>/dev/null || true
    PID=""
  done
  if [[ -z "$PID" ]] || ! kill -0 "$PID" 2>/dev/null; then
    echo "FAIL: server did not start after 5 port attempts"; exit 1
  fi
else
  MOCK_DATA_DIR="$TMPDIR" "$BINARY" --port "$PORT" &>/tmp/mint-diet-smoke.log &
  PID=$!
  for _i in $(seq 1 30); do
    if curl -sf "http://localhost:$PORT/health" >/dev/null 2>&1; then break; fi
    sleep 0.2
    if [[ $_i -eq 30 ]]; then echo "FAIL: server did not start"; exit 1; fi
  done
fi

BASE="http://localhost:$PORT"
PASS=0
FAIL=0

check() {
  local desc="$1" result="$2" pattern="$3"
  if echo "$result" | grep -q "$pattern"; then
    echo "PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $desc (expected: $pattern)"
    echo "  Got: $(echo "$result" | head -3)"
    FAIL=$((FAIL + 1))
  fi
}

# Check 1: GET /health → {"ok":true}
check "1. GET /health" "$(curl -sf "$BASE/health")" '"ok":true'

# Check 2: GET /__mock_sentinel__/mint-diet → {"sentinel":true}
check "2. GET /__mock_sentinel__/mint-diet" "$(curl -sf "$BASE/__mock_sentinel__/mint-diet")" '"sentinel":true'

# Check 3: GET /log → 302 redirect to today's exact dated route
TODAY=$(date +%Y-%m-%d)
REDIR_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/log")
REDIR_LOC=$(curl -sD - -o /dev/null "$BASE/log" | grep -i "^location:" | tr -d '\r\n' | sed 's/[Ll]ocation: *//')
check "3a. GET /log returns 302" "$REDIR_STATUS" "^302$"
check "3b. GET /log redirects to today's date (/log/$TODAY)" "$REDIR_LOC" "^/log/${TODAY}$"

# Check 4: GET /log/2026-04-22 → all four slot labels present
DAY_VIEW_4="$(curl -sf "$BASE/log/2026-04-22")"
check "4a. Day view has Breakfast" "$DAY_VIEW_4" "Breakfast"
check "4b. Day view has Lunch"     "$DAY_VIEW_4" "Lunch"
check "4c. Day view has Dinner"    "$DAY_VIEW_4" "Dinner"
check "4d. Day view has Snacks"    "$DAY_VIEW_4" "Snacks"

# Check 5: GET /log/2026-04-22/add/breakfast?q=rice → seed food present
check "5. Food search returns seed food" "$(curl -sf "$BASE/log/2026-04-22/add/breakfast?q=rice")" "rice\|Rice"

# Check 6: POST /log/:date/entries → entry appears on day view
STATUS=$(curl -sf -X POST "$BASE/log/2026-04-22/entries" \
  -d "slot=breakfast&food_name=White+Rice&quantity_value=150&quantity_unit=g&calories_kcal=195&protein_g=4&carbs_g=43&fat_g=0.4&food_catalog_id=" \
  -w "%{http_code}" -o /tmp/smoke-entry.html)
check "6a. POST /log/:date/entries returns 303" "$STATUS" "^303$"
check "6b. Entry appears on day view" "$(curl -sf "$BASE/log/2026-04-22")" "White Rice"

# Checks 7/8/9: all depend on ENTRY_ID extracted from the day view.
# If the ID is missing the entry edit link is absent — that is a regression.
# Fail all four dependent assertions rather than silently skipping them.
ENTRY_ID="$(curl -sf "$BASE/log/2026-04-22" | grep -o 'entry/[0-9]*/edit' | head -1 | grep -o '[0-9]*')"
if [[ -n "$ENTRY_ID" ]]; then
  # Check 7: GET /log/entry/:id/edit → form prefilled
  check "7. GET /log/entry/:id/edit shows prefilled form" \
    "$(curl -sf "$BASE/log/entry/$ENTRY_ID/edit")" "White Rice"

  # Check 8: before edit → 195 kcal in summary; after edit → 260 kcal
  # SummaryPanel renders "{n} kcal" (space); entry rows render "{n}kcal" (no space)
  # so "195 kcal" is uniquely from the aggregate summary total.
  DAY_BEFORE="$(curl -sf "$BASE/log/2026-04-22")"
  check "8a. Day view summary shows original total (195 kcal)" "$DAY_BEFORE" "195 kcal"
  curl -sf -X POST "$BASE/log/entries/$ENTRY_ID" \
    -d "food_name=White+Rice&quantity_value=200&quantity_unit=g&calories_kcal=260&protein_g=5.4&carbs_g=57&fat_g=0.5" \
    -o /dev/null
  DAY_AFTER_EDIT="$(curl -sf "$BASE/log/2026-04-22")"
  check "8b. Day view summary shows updated total (260 kcal)" "$DAY_AFTER_EDIT" "260 kcal"

  # Check 9: POST /log/entries/:id/delete → entry gone from day view
  curl -sf -X POST "$BASE/log/entries/$ENTRY_ID/delete" -o /dev/null
  DAY_AFTER="$(curl -sf "$BASE/log/2026-04-22")"
  if echo "$DAY_AFTER" | grep -q "White Rice"; then
    echo "FAIL: 9. Entry still present after delete"; FAIL=$((FAIL + 1))
  else
    echo "PASS: 9. Entry gone after delete"; PASS=$((PASS + 1))
  fi
else
  echo "FAIL: 7/8/9 — entry ID not found in day-view HTML (checks 7, 8a, 8b, 9 cannot run)"
  FAIL=$((FAIL + 4))
fi

# Check 10: POST /plans with target_calories_kcal → day view shows plan budget + note
# Plan covers 2026-04-20 through 2026-04-25 (6 days)
STATUS=$(curl -sf -X POST "$BASE/plans" \
  -d "title=Smoke+Plan&start_date=2026-04-20&end_date=2026-04-25&status=active&target_calories_kcal=1800&notes=smoke+test" \
  -w "%{http_code}" -o /tmp/smoke-plan.html)
check "10a. POST /plans returns 303" "$STATUS" "^303$"
check "10b. Day view shows plan budget" "$(curl -sf "$BASE/log/2026-04-22")" "1800"
check "10c. Day view shows from-plan note" "$(curl -sf "$BASE/log/2026-04-22")" "Smoke Plan\|Budget from plan"

# Checks 11-15: all depend on PLAN_ID extracted from the plans list.
# If the plan link is missing from the list that is a regression; fail all 17
# dependent assertions rather than silently skipping them.
PLAN_ID="$(curl -sf "$BASE/plans" | grep -o 'href="/plans/[0-9]*"' | head -1 | grep -o '[0-9]*')"
if [[ -n "$PLAN_ID" ]]; then

  # Check 11: GET /plans/:id → all 6 days present, ingredients tab empty, add/delete cycle
  PLAN_VIEW="$(curl -sf "$BASE/plans/$PLAN_ID")"
  check "11a. Plan shows day 2026-04-20" "$PLAN_VIEW" "2026-04-20"
  check "11b. Plan shows day 2026-04-21" "$PLAN_VIEW" "2026-04-21"
  check "11c. Plan shows day 2026-04-22" "$PLAN_VIEW" "2026-04-22"
  check "11d. Plan shows day 2026-04-23" "$PLAN_VIEW" "2026-04-23"
  check "11e. Plan shows day 2026-04-24" "$PLAN_VIEW" "2026-04-24"
  check "11f. Plan shows day 2026-04-25" "$PLAN_VIEW" "2026-04-25"
  ING_VIEW="$(curl -sf "$BASE/plans/$PLAN_ID?tab=ingredients")"
  check "11g. Ingredients tab shows empty state" "$ING_VIEW" "No ingredients added yet"

  # Check 11h/11i: add ingredient → verify appears (11h); delete it → verify gone (11i)
  # 11i depends on ING_ID extracted from the rendered formaction attribute.
  # A missing formaction means the Del button cannot reach the delete route — hard failure.
  curl -sf -X POST "$BASE/plans/$PLAN_ID/ingredients" \
    -d "name=Brown+Rice&quantity_value=100&quantity_unit=g" -o /dev/null
  ING_VIEW2="$(curl -sf "$BASE/plans/$PLAN_ID?tab=ingredients")"
  check "11h. Ingredient appears after add" "$ING_VIEW2" "Brown Rice"
  ING_ID="$(echo "$ING_VIEW2" | grep -o 'formaction="/plans/[0-9]*/ingredients/[0-9]*/delete"' | head -1 | grep -o 'ingredients/[0-9]*' | grep -o '[0-9]*$')"
  if [[ -n "$ING_ID" ]]; then
    curl -sf -X POST "$BASE/plans/$PLAN_ID/ingredients/$ING_ID/delete" -o /dev/null
    ING_VIEW3="$(curl -sf "$BASE/plans/$PLAN_ID?tab=ingredients")"
    check "11i. Ingredient gone after delete" "$ING_VIEW3" "No ingredients added yet"
  else
    echo "FAIL: 11i — ingredient delete formaction not found in rendered HTML"
    FAIL=$((FAIL + 1))
  fi

  # Check 12: POST /plans/:id/items → item appears on slot editor; explicit item delete (12c)
  # 12c depends on ITEM_ID extracted from the formaction attribute — same reasoning as 11i.
  STATUS=$(curl -sf -X POST "$BASE/plans/$PLAN_ID/items" \
    -d "plan_date=2026-04-22&meal_slot=breakfast&dish_name=Oatmeal&notes=" \
    -w "%{http_code}" -o /tmp/smoke-item.html)
  check "12a. POST /plans/:id/items returns 303" "$STATUS" "^303$"
  SLOT_VIEW="$(curl -sf "$BASE/plans/$PLAN_ID/days/2026-04-22/slots/breakfast/edit")"
  check "12b. Item appears on slot editor" "$SLOT_VIEW" "Oatmeal"
  ITEM_ID="$(echo "$SLOT_VIEW" | grep -o 'formaction="/plans/[0-9]*/items/[0-9]*/delete"' | head -1 | grep -o 'items/[0-9]*' | grep -o '[0-9]*$')"
  if [[ -n "$ITEM_ID" ]]; then
    curl -sf -X POST "$BASE/plans/$PLAN_ID/items/$ITEM_ID/delete" -o /dev/null
    SLOT_AFTER="$(curl -sf "$BASE/plans/$PLAN_ID/days/2026-04-22/slots/breakfast/edit")"
    if echo "$SLOT_AFTER" | grep -q "Oatmeal"; then
      echo "FAIL: 12c. Plan item still present after delete"; FAIL=$((FAIL + 1))
    else
      echo "PASS: 12c. Plan item gone after delete"; PASS=$((PASS + 1))
    fi
  else
    echo "FAIL: 12c — item delete formaction not found in rendered slot editor HTML"
    FAIL=$((FAIL + 1))
  fi

  # Add a survivor item on 2026-04-23 (survives the shrink below).
  # Used in check 14b to prove existing day items are intact after expand.
  curl -sf -X POST "$BASE/plans/$PLAN_ID/items" \
    -d "plan_date=2026-04-23&meal_slot=breakfast&dish_name=Porridge&notes=" \
    -o /dev/null

  # Check 13: POST plan edit to shorter date range → removed day cascaded
  curl -sf -X POST "$BASE/plans/$PLAN_ID" \
    -d "title=Smoke+Plan&start_date=2026-04-23&end_date=2026-04-25&status=active&target_calories_kcal=1800&notes=shrunk" \
    -o /dev/null
  SHRUNK="$(curl -sf "$BASE/plans/$PLAN_ID")"
  if echo "$SHRUNK" | grep -q "2026-04-20\|2026-04-21\|2026-04-22"; then
    echo "FAIL: 13. Removed day still present after shrink"; FAIL=$((FAIL + 1))
  else
    echo "PASS: 13. Removed days gone after shrink"; PASS=$((PASS + 1))
  fi

  # Check 14: POST plan edit to longer date range → new days added, existing day items intact
  curl -sf -X POST "$BASE/plans/$PLAN_ID" \
    -d "title=Smoke+Plan&start_date=2026-04-22&end_date=2026-04-27&status=active&target_calories_kcal=1800&notes=expanded" \
    -o /dev/null
  EXPANDED="$(curl -sf "$BASE/plans/$PLAN_ID")"
  check "14a. Expand plan - new day added" "$EXPANDED" "2026-04-26\|2026-04-27"
  # Porridge was added to 2026-04-23 before the shrink; that day survived the shrink and
  # must survive the expand too — proving existing day items are intact after expand.
  check "14b. Expand plan - surviving day item (Porridge) still present" "$EXPANDED" "Porridge"

  # Check 15: POST /plans/:id/delete → plan gone from list; GET /plans/:id returns 404
  curl -sf -X POST "$BASE/plans/$PLAN_ID/delete" -o /dev/null
  PLAN_LIST="$(curl -sf "$BASE/plans")"
  if echo "$PLAN_LIST" | grep -q "Smoke Plan"; then
    echo "FAIL: 15a. Deleted plan still in list"; FAIL=$((FAIL + 1))
  else
    echo "PASS: 15a. Plan removed from list"; PASS=$((PASS + 1))
  fi
  NOT_FOUND=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/plans/$PLAN_ID")
  check "15b. GET /plans/:id returns 404 after delete" "$NOT_FOUND" "^404$"

else
  echo "FAIL: 11-15 — plan ID not found in plans list (checks 11a-11i, 12a-12c, 13, 14a-14b, 15a-15b cannot run)"
  FAIL=$((FAIL + 17))
fi

# Check 16: Two plans with different start_dates covering same date → earlier start wins
curl -sf -X POST "$BASE/plans" \
  -d "title=Plan+A&start_date=2026-05-01&end_date=2026-05-07&status=active&target_calories_kcal=1600&notes=" \
  -o /dev/null
# Plan B starts later (2026-05-03), target 2000 — should NOT win the overlap
curl -sf -X POST "$BASE/plans" \
  -d "title=Plan+B&start_date=2026-05-03&end_date=2026-05-07&status=active&target_calories_kcal=2000&notes=" \
  -o /dev/null
# 2026-05-05 is covered by both; Plan A (earlier start 2026-05-01) should win → budget 1600
check "16. Earlier start_date plan wins overlap" "$(curl -sf "$BASE/log/2026-05-05")" "1600"

# Check 17a: Invalid date → 400
check "17a. GET /log/2026-13-45 → 400" \
  "$(curl -s -o /dev/null -w "%{http_code}" "$BASE/log/2026-13-45")" "^400$"

# Check 17b: Missing entry edit → 404
check "17b. GET /log/entry/999999/edit → 404" \
  "$(curl -s -o /dev/null -w "%{http_code}" "$BASE/log/entry/999999/edit")" "^404$"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]
