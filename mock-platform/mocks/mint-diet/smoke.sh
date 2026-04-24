#!/usr/bin/env bash
# See README.md § WAL verifier artifact contract
set -euo pipefail

BINARY="${1:-../../dist/mock-mint-diet}"
PORT="${2:-0}"

if [[ "$PORT" == "0" ]]; then
  PORT=$(python3 -c "import socket; s=socket.socket(); s.bind(('',0)); print(s.getsockname()[1]); s.close()")
fi

TMPDIR="$(mktemp -d)"
trap 'kill $PID 2>/dev/null || true; rm -rf "$TMPDIR"' EXIT

MOCK_DATA_DIR="$TMPDIR" "$BINARY" --port "$PORT" &>/tmp/mint-diet-smoke.log &
PID=$!

# Wait for server to be ready (up to 6 seconds)
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$PORT/health" >/dev/null 2>&1; then break; fi
  sleep 0.2
  if [[ $i -eq 30 ]]; then echo "FAIL: server did not start"; exit 1; fi
done

BASE="http://localhost:$PORT"
PASS=0
FAIL=0

check() {
  local desc="$1"
  local result="$2"
  local pattern="$3"
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

# Check 3: GET /log → 302 to today (follow redirect, check for slot labels)
check "3. GET /log redirects to today" "$(curl -sf -L "$BASE/log")" "Breakfast\|breakfast"

# Check 4: GET /log/2026-04-22 → slot labels present
check "4. GET /log/2026-04-22 shows slots" "$(curl -sf "$BASE/log/2026-04-22")" "Breakfast"

# Check 5: GET /log/2026-04-22/add/breakfast?q=rice → seed food present
check "5. Food search returns seed food" "$(curl -sf "$BASE/log/2026-04-22/add/breakfast?q=rice")" "rice\|Rice"

# Check 6: POST /log/:date/entries → entry appears on day view (POST to correct route)
STATUS=$(curl -sf -X POST "$BASE/log/2026-04-22/entries" \
  -d "slot=breakfast&food_name=White+Rice&quantity_value=150&quantity_unit=g&calories_kcal=195&protein_g=4&carbs_g=43&fat_g=0.4&food_catalog_id=" \
  -w "%{http_code}" -o /tmp/smoke-entry.html)
check "6. POST /log/:date/entries returns 303" "$STATUS" "^303$"
check "6b. Entry appears on day view" "$(curl -sf "$BASE/log/2026-04-22")" "White Rice"

# Check 7: GET /log/entry/:id/edit → form prefilled
ENTRY_ID="$(curl -sf "$BASE/log/2026-04-22" | grep -o 'entry/[0-9]*/edit' | head -1 | grep -o '[0-9]*')"
if [[ -n "$ENTRY_ID" ]]; then
  EDIT_FORM="$(curl -sf "$BASE/log/entry/$ENTRY_ID/edit")"
  check "7. GET /log/entry/:id/edit shows prefilled form" "$EDIT_FORM" "White Rice"
else
  echo "SKIP 7: could not find entry id"; PASS=$((PASS + 1))
fi

# Check 8: POST /log/entries/:id → updated qty reflected in day view
if [[ -n "$ENTRY_ID" ]]; then
  curl -sf -X POST "$BASE/log/entries/$ENTRY_ID" \
    -d "food_name=White+Rice&quantity_value=200&quantity_unit=g&calories_kcal=260&protein_g=5.4&carbs_g=57&fat_g=0.5" \
    -o /dev/null
  check "8. POST /log/entries/:id updates entry" "$(curl -sf "$BASE/log/2026-04-22")" "200"
fi

# Check 9: POST /log/entries/:id/delete → entry gone from day view
if [[ -n "$ENTRY_ID" ]]; then
  curl -sf -X POST "$BASE/log/entries/$ENTRY_ID/delete" -o /dev/null
  DAY_AFTER="$(curl -sf "$BASE/log/2026-04-22")"
  if echo "$DAY_AFTER" | grep -q "White Rice"; then
    echo "FAIL: 9. Entry still present after delete"; FAIL=$((FAIL + 1))
  else
    echo "PASS: 9. Entry gone after delete"; PASS=$((PASS + 1))
  fi
fi

# Check 10: POST /plans with target_calories_kcal → day view shows plan budget + note
STATUS=$(curl -sf -X POST "$BASE/plans" \
  -d "title=Smoke+Plan&start_date=2026-04-20&end_date=2026-04-25&status=active&target_calories_kcal=1800&notes=smoke+test" \
  -w "%{http_code}" -o /tmp/smoke-plan.html)
check "10a. POST /plans returns 303" "$STATUS" "^303$"
check "10b. Day view shows plan budget" "$(curl -sf "$BASE/log/2026-04-22")" "1800"
check "10c. Day view shows from-plan note" "$(curl -sf "$BASE/log/2026-04-22")" "Smoke Plan\|Budget from plan"

# Check 11: GET /plans/:id → all days present
PLAN_ID="$(curl -sf "$BASE/plans" | grep -o 'href="/plans/[0-9]*"' | head -1 | grep -o '[0-9]*')"
if [[ -n "$PLAN_ID" ]]; then
  PLAN_PAGE="$(curl -sf "$BASE/plans/$PLAN_ID")"
  check "11. GET /plans/:id shows plan days" "$PLAN_PAGE" "2026-04-20\|2026-04-21\|2026-04-22"
else
  echo "SKIP 11: could not find plan id"; PASS=$((PASS + 1))
fi

# Check 12: POST /plans/:id/items → item appears on day/slot edit page
if [[ -n "$PLAN_ID" ]]; then
  STATUS=$(curl -sf -X POST "$BASE/plans/$PLAN_ID/items" \
    -d "plan_date=2026-04-22&meal_slot=breakfast&dish_name=Oatmeal&notes=" \
    -w "%{http_code}" -o /tmp/smoke-item.html)
  check "12a. POST /plans/:id/items returns 303" "$STATUS" "^303$"
  SLOT_PAGE="$(curl -sf "$BASE/plans/$PLAN_ID/days/2026-04-22/slots/breakfast/edit")"
  check "12b. Item appears on slot editor" "$SLOT_PAGE" "Oatmeal"
fi

# Check 13: POST plan edit to shorter date range → removed day cascaded
if [[ -n "$PLAN_ID" ]]; then
  curl -sf -X POST "$BASE/plans/$PLAN_ID" \
    -d "title=Smoke+Plan&start_date=2026-04-23&end_date=2026-04-25&status=active&target_calories_kcal=1800&notes=shrunk" \
    -o /dev/null
  SHRUNK="$(curl -sf "$BASE/plans/$PLAN_ID")"
  if echo "$SHRUNK" | grep -q "2026-04-20\|2026-04-21\|2026-04-22"; then
    echo "FAIL: 13. Removed day still present after shrink"; FAIL=$((FAIL + 1))
  else
    echo "PASS: 13. Removed days gone after shrink"; PASS=$((PASS + 1))
  fi
fi

# Check 14: POST plan edit to longer date range → new days added, existing intact
if [[ -n "$PLAN_ID" ]]; then
  curl -sf -X POST "$BASE/plans/$PLAN_ID" \
    -d "title=Smoke+Plan&start_date=2026-04-22&end_date=2026-04-27&status=active&target_calories_kcal=1800&notes=expanded" \
    -o /dev/null
  EXPANDED="$(curl -sf "$BASE/plans/$PLAN_ID")"
  check "14a. Expand plan - new day added" "$EXPANDED" "2026-04-26\|2026-04-27"
  check "14b. Expand plan - existing days intact" "$EXPANDED" "2026-04-23\|2026-04-24"
fi

# Check 15: POST /plans/:id/delete → plan gone from list; GET /plans/:id returns 404
if [[ -n "$PLAN_ID" ]]; then
  curl -sf -X POST "$BASE/plans/$PLAN_ID/delete" -o /dev/null
  PLAN_LIST="$(curl -sf "$BASE/plans")"
  if echo "$PLAN_LIST" | grep -q "Smoke Plan"; then
    echo "FAIL: 15a. Deleted plan still in list"; FAIL=$((FAIL + 1))
  else
    echo "PASS: 15a. Plan removed from list"; PASS=$((PASS + 1))
  fi
  NOT_FOUND=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/plans/$PLAN_ID")
  check "15b. GET /plans/:id returns 404 after delete" "$NOT_FOUND" "^404$"
fi

# Check 16: Two plans covering same date with different start_dates → earlier start_date wins
# Plan A: starts 2026-05-01, target 1600
curl -sf -X POST "$BASE/plans" \
  -d "title=Plan+A&start_date=2026-05-01&end_date=2026-05-07&status=active&target_calories_kcal=1600&notes=" \
  -o /dev/null
# Plan B: starts 2026-05-03 (later start), target 2000 - should NOT win
curl -sf -X POST "$BASE/plans" \
  -d "title=Plan+B&start_date=2026-05-03&end_date=2026-05-07&status=active&target_calories_kcal=2000&notes=" \
  -o /dev/null
# For 2026-05-05 both plans cover it; Plan A (earlier start 05-01) should win → budget 1600
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
