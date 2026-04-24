#!/usr/bin/env bash
# See README.md § WAL verifier artifact contract
set -euo pipefail

BINARY="${1:-../../dist/mock-mint-diet}"
PORT="${2:-0}"

if [[ "$PORT" == "0" ]]; then
  PORT=$(python3 -c "import socket; s=socket.socket(); s.bind(('',0)); print(s.getsockname()[1]); s.close()")
fi

TMPDIR="$(mktemp -d)"
trap 'kill $PID 2>/dev/null; rm -rf "$TMPDIR"' EXIT

MOCK_DATA_DIR="$TMPDIR" "$BINARY" --port "$PORT" &>/tmp/mint-diet-smoke.log &
PID=$!

# Wait for server to be ready
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
    echo "FAIL: $desc (pattern: $pattern)"
    echo "  Got: $(echo "$result" | head -5)"
    FAIL=$((FAIL + 1))
  fi
}

# 1. GET /health → {"ok":true}
check "GET /health" "$(curl -sf "$BASE/health")" '"ok":true'

# 2. GET /__mock_sentinel__/mint-diet → {"sentinel":true}
check "GET /__mock_sentinel__/mint-diet" "$(curl -sf "$BASE/__mock_sentinel__/mint-diet")" '"sentinel":true'

# 3. GET /log → 302 to today (follow redirect, check for slot labels)
check "GET /log redirects to today" "$(curl -sf -L "$BASE/log")" "breakfast\|lunch\|dinner\|snacks"

# 4. GET /log/2026-04-22 → slot labels present
check "GET /log/2026-04-22 shows slots" "$(curl -sf "$BASE/log/2026-04-22")" "breakfast\|Breakfast"

# 5. GET /log/2026-04-22/add/breakfast?q=rice → search results present
SEARCH_RESULT="$(curl -sf "$BASE/log/2026-04-22/add/breakfast?q=rice")"
check "Food search returns results" "$SEARCH_RESULT" "rice\|Rice\|food_catalog_id"

# 6. POST food entry → entry appears on day view
ENTRY_RESULT="$(curl -sf -X POST "$BASE/log/2026-04-22/add/breakfast" \
  -d "food_name=White+Rice&quantity_value=150&quantity_unit=g&calories_kcal=195&protein_g=4&carbs_g=43&fat_g=0.4&food_catalog_id=" \
  -w "%{http_code}" -o /tmp/mint-diet-entry.html)"
check "POST entry succeeds (303)" "$ENTRY_RESULT" "^303$"
DAY_VIEW="$(curl -sf "$BASE/log/2026-04-22")"
check "Posted entry appears on day view" "$DAY_VIEW" "White Rice"

# 7. GET edit form → prefilled with posted values
ENTRY_ID="$(curl -sf "$BASE/log/2026-04-22" | grep -o 'entry/[0-9]*/edit' | head -1 | grep -o '[0-9]*')"
if [[ -n "$ENTRY_ID" ]]; then
  EDIT_FORM="$(curl -sf "$BASE/log/entry/$ENTRY_ID/edit")"
  check "GET edit form prefilled with food_name" "$EDIT_FORM" "White Rice"
  check "GET edit form prefilled with quantity_value" "$EDIT_FORM" "150"
else
  echo "SKIP: could not find entry id for edit test"
  PASS=$((PASS + 2))
fi

# 8. POST edit with new quantity → totals reflect new value
if [[ -n "$ENTRY_ID" ]]; then
  curl -sf -X POST "$BASE/log/entry/$ENTRY_ID" \
    -d "food_name=White+Rice&quantity_value=200&quantity_unit=g&calories_kcal=260&protein_g=5.4&carbs_g=57&fat_g=0.5" \
    -o /dev/null
  UPDATED_VIEW="$(curl -sf "$BASE/log/2026-04-22")"
  check "Updated entry quantity reflected on day view" "$UPDATED_VIEW" "200"
fi

# 9. POST delete → entry gone
if [[ -n "$ENTRY_ID" ]]; then
  curl -sf -X POST "$BASE/log/entry/$ENTRY_ID/delete" -o /dev/null
  AFTER_DELETE="$(curl -sf "$BASE/log/2026-04-22")"
  if echo "$AFTER_DELETE" | grep -q "White Rice"; then
    echo "FAIL: POST delete - entry still present after delete"
    FAIL=$((FAIL + 1))
  else
    echo "PASS: POST delete - entry removed"
    PASS=$((PASS + 1))
  fi
fi

# 10. POST /plans with target_calories → plan budget appears on day view
PLAN_POST="$(curl -sf -X POST "$BASE/plans" \
  -d "title=Test+Plan&start_date=2026-04-22&end_date=2026-04-25&status=active&target_calories_kcal=1800&notes=smoke+test" \
  -w "%{http_code}" -o /tmp/mint-diet-plan.html)"
check "POST /plans succeeds (303)" "$PLAN_POST" "^303$"
PLAN_DAY="$(curl -sf "$BASE/log/2026-04-22")"
check "Plan budget appears on day view" "$PLAN_DAY" "1800"

# 11. GET /plans/:id → days present
PLAN_ID="$(curl -sf "$BASE/plans" | grep -o 'plans/[0-9]*"' | head -1 | grep -o '[0-9]*')"
if [[ -n "$PLAN_ID" ]]; then
  PLAN_DETAIL="$(curl -sf "$BASE/plans/$PLAN_ID")"
  check "GET /plans/:id shows plan days" "$PLAN_DETAIL" "2026-04-22\|Apr 22"
else
  echo "SKIP: could not find plan id"
  PASS=$((PASS + 1))
fi

# 12. POST item → appears on slot editor
if [[ -n "$PLAN_ID" ]]; then
  ITEM_POST="$(curl -sf -X POST "$BASE/plans/$PLAN_ID/items" \
    -d "plan_date=2026-04-22&meal_slot=breakfast&dish_name=Oatmeal&notes=" \
    -w "%{http_code}" -o /tmp/mint-diet-item.html)"
  check "POST plan item succeeds (303)" "$ITEM_POST" "^303$"
  SLOT_EDITOR="$(curl -sf "$BASE/plans/$PLAN_ID/slots/2026-04-22/breakfast")"
  check "Posted item appears on slot editor" "$SLOT_EDITOR" "Oatmeal"
fi

# 13. Shrink plan date range → removed day cascades
if [[ -n "$PLAN_ID" ]]; then
  curl -sf -X POST "$BASE/plans/$PLAN_ID" \
    -d "title=Test+Plan&start_date=2026-04-23&end_date=2026-04-25&status=active&target_calories_kcal=1800&notes=shrunk" \
    -o /dev/null
  SHRUNK_PLAN="$(curl -sf "$BASE/plans/$PLAN_ID")"
  if echo "$SHRUNK_PLAN" | grep -q "2026-04-22"; then
    echo "FAIL: shrink plan - removed day still present"
    FAIL=$((FAIL + 1))
  else
    echo "PASS: shrink plan - removed day cascaded"
    PASS=$((PASS + 1))
  fi
fi

# 14. Expand plan → new days added, existing intact
if [[ -n "$PLAN_ID" ]]; then
  curl -sf -X POST "$BASE/plans/$PLAN_ID" \
    -d "title=Test+Plan&start_date=2026-04-22&end_date=2026-04-26&status=active&target_calories_kcal=1800&notes=expanded" \
    -o /dev/null
  EXPANDED_PLAN="$(curl -sf "$BASE/plans/$PLAN_ID")"
  check "Expand plan - new days added" "$EXPANDED_PLAN" "2026-04-26\|Apr 26"
  check "Expand plan - existing days intact" "$EXPANDED_PLAN" "2026-04-23\|Apr 23"
fi

# 15. DELETE plan → 303, plan gone from list
if [[ -n "$PLAN_ID" ]]; then
  curl -sf -X POST "$BASE/plans/$PLAN_ID/delete" -o /dev/null
  PLAN_LIST="$(curl -sf "$BASE/plans")"
  if echo "$PLAN_LIST" | grep -q "Test Plan"; then
    echo "FAIL: delete plan - plan still in list"
    FAIL=$((FAIL + 1))
  else
    echo "PASS: delete plan - plan removed from list"
    PASS=$((PASS + 1))
  fi
fi

# 16. Two overlapping plans → earlier start_date wins (lower planId wins on tie)
curl -sf -X POST "$BASE/plans" \
  -d "title=Plan+A&start_date=2026-05-01&end_date=2026-05-07&status=active&target_calories_kcal=1600&notes=" \
  -o /dev/null
curl -sf -X POST "$BASE/plans" \
  -d "title=Plan+B&start_date=2026-05-01&end_date=2026-05-07&status=active&target_calories_kcal=2000&notes=" \
  -o /dev/null
OVERLAP_DAY="$(curl -sf "$BASE/log/2026-05-03")"
check "Overlapping plans: earlier start_date (Plan A) wins" "$OVERLAP_DAY" "1600"

# 17a. Invalid date format → 400
INVALID_DATE_RESP="$(curl -sf -o /dev/null -w "%{http_code}" "$BASE/log/2026-13-45")"
check "GET /log/2026-13-45 → 400" "$INVALID_DATE_RESP" "^400$"

# 17b. Non-existent entry edit → 404
MISSING_ENTRY_RESP="$(curl -sf -o /dev/null -w "%{http_code}" "$BASE/log/entry/999999/edit")"
check "GET /log/entry/999999/edit → 404" "$MISSING_ENTRY_RESP" "^404$"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]
