#!/bin/bash
# negative-path-checks.sh — targeted fail-fast and error-handling checks
#
# Runs mock TypeScript source directly via bun on the host (no Docker needed).
# Uses env var overrides to point at temp directories.
#
# Prerequisites: bun, mock-platform dependencies installed.

set -euo pipefail

PASS=0
FAIL=0

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOCK_PLATFORM="$(cd "$SCRIPT_DIR/.." && pwd)"

check() {
  local desc="$1" result="$2"
  if [ "$result" = "PASS" ]; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc"
    FAIL=$((FAIL + 1))
  fi
}

cleanup() {
  # Kill any lingering mock processes
  for pid in ${SHOP_PID:-} ${DOC_PID:-} ${WF_PID:-} ; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  rm -rf "${TMPDIR:-}"
}
trap cleanup EXIT

TMPDIR=$(mktemp -d)
SHOP_SRC="$MOCK_PLATFORM/mocks/shop/src/index.tsx"
DOC_SRC="$MOCK_PLATFORM/mocks/doc-search/src/index.ts"

# Kill any lingering processes on our fixed ports to prevent EADDRINUSE
for port in 19001 19002 19003 19998 19999; do
  pids=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  WARN: Killing lingering processes on port $port"
    kill -9 $pids 2>/dev/null || true
  fi
done
sleep 1

echo "=== Negative-Path Checks ==="
echo "Temp dir: $TMPDIR"
echo ""

# ---------------------------------------------------------------
# Test 1: Corrupted products.json → exit non-zero
# ---------------------------------------------------------------
echo "--- Test 1: Corrupted products.json → exit non-zero ---"
mkdir -p "$TMPDIR/corrupt/static/shop"
echo "NOT JSON" > "$TMPDIR/corrupt/static/shop/products.json"
(
  MOCK_PRODUCTS_PATH="$TMPDIR/corrupt/static/shop/products.json" \
  MOCK_DATA_DIR="$TMPDIR/corrupt/data" \
  bun run "$SHOP_SRC" --port 19001 >/dev/null 2>&1
) &
TEST_PID=$!
sleep 2
if ps -p $TEST_PID > /dev/null 2>&1; then
  check "Corrupted products.json exits non-zero" "FAIL (process still running)"
  kill $TEST_PID 2>/dev/null || true
else
  check "Corrupted products.json exits non-zero" "PASS"
fi
wait $TEST_PID 2>/dev/null || true

# ---------------------------------------------------------------
# Test 2: Missing products.json → exit non-zero
# ---------------------------------------------------------------
echo "--- Test 2: Missing products.json → exit non-zero ---"
mkdir -p "$TMPDIR/missing/static/shop"
(
  MOCK_PRODUCTS_PATH="$TMPDIR/missing/static/shop/products.json" \
  MOCK_DATA_DIR="$TMPDIR/missing/data" \
  bun run "$SHOP_SRC" --port 19002 >/dev/null 2>&1
) &
TEST_PID=$!
sleep 2
if ps -p $TEST_PID > /dev/null 2>&1; then
  check "Missing products.json exits non-zero" "FAIL (process still running)"
  kill $TEST_PID 2>/dev/null || true
else
  check "Missing products.json exits non-zero" "PASS"
fi
wait $TEST_PID 2>/dev/null || true

# ---------------------------------------------------------------
# Test 3: Missing SQL seed for doc-search → exit non-zero
# ---------------------------------------------------------------
echo "--- Test 3: Doc-search missing SQL seed → exit non-zero ---"
mkdir -p "$TMPDIR/docsearch-missing"
(
  BROWSER_MOCK_DATA_DIR="$TMPDIR/docsearch-missing" \
  HOME="$TMPDIR/docsearch-missing" \
  bun run "$DOC_SRC" --port 19003 >/dev/null 2>&1
) &
TEST_PID=$!
sleep 2
if ps -p $TEST_PID > /dev/null 2>&1; then
  check "Missing SQL seed exits non-zero" "FAIL (process still running)"
  kill $TEST_PID 2>/dev/null || true
else
  check "Missing SQL seed exits non-zero" "PASS"
fi
wait $TEST_PID 2>/dev/null || true

# ---------------------------------------------------------------
# Test 4-11: HTTP validation with live shop
# ---------------------------------------------------------------
echo "--- Test 4-11: HTTP validation tests ---"

# Create valid products.json for live shop
mkdir -p "$TMPDIR/live/static/shop" "$TMPDIR/live/data"
cat > "$TMPDIR/live/static/shop/products.json" << 'PRODUCTS'
[{"id":"p1","name":"Test Widget","category":"electronics","price":29.99,"original_price":39.99,"rating":4.5,"review_count":100,"image":"/img/widget.jpg","description":"A fine test widget","tags":["test","electronics"],"stock":50}]
PRODUCTS

# Start shop in background
MOCK_PRODUCTS_PATH="$TMPDIR/live/static/shop/products.json" \
  MOCK_DATA_DIR="$TMPDIR/live/data" \
  bun run "$SHOP_SRC" --port 19999 >/dev/null 2>&1 &
SHOP_PID=$!

# Wait for shop to be healthy
READY=false
for i in $(seq 1 15); do
  if curl -sf http://localhost:19999/health 2>/dev/null | grep -q "healthy"; then
    READY=true
    break
  fi
  sleep 1
done

if [ "$READY" = true ]; then
  # Test 4: Malformed JSON to /api/cart/add → 400
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:19999/api/cart/add \
    -H "Content-Type: application/json" -d "not json")
  check "Malformed JSON to cart/add returns 400 (got $R)" "$([ "$R" = "400" ] && echo PASS || echo FAIL)"

  # Test 5: Malformed JSON to /api/cart/update → 400
  R=$(curl -s -o /dev/null -w "%{http_code}" -X PUT http://localhost:19999/api/cart/update \
    -H "Content-Type: application/json" -d "{bad")
  check "Malformed JSON to cart/update returns 400 (got $R)" "$([ "$R" = "400" ] && echo PASS || echo FAIL)"

  # Test 6: Malformed JSON to /api/user/update → 400
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:19999/api/user/update \
    -H "Content-Type: application/json" -d "xyz")
  check "Malformed JSON to user/update returns 400 (got $R)" "$([ "$R" = "400" ] && echo PASS || echo FAIL)"

  # Test 7: Invalid min_price → 400
  R=$(curl -s -o /dev/null -w "%{http_code}" \
    "http://localhost:19999/search?min_price=abc")
  check "Invalid min_price to /search returns 400 (got $R)" "$([ "$R" = "400" ] && echo PASS || echo FAIL)"

  # Test 8: Invalid max_price → 400
  R=$(curl -s -o /dev/null -w "%{http_code}" \
    "http://localhost:19999/api/products?max_price=xyz")
  check "Invalid max_price to /api/products returns 400 (got $R)" "$([ "$R" = "400" ] && echo PASS || echo FAIL)"

  # Test 9: Missing product_id in cart/add → 400
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:19999/api/cart/add \
    -H "Content-Type: application/json" -d '{}')
  check "Missing product_id in cart/add returns 400 (got $R)" "$([ "$R" = "400" ] && echo PASS || echo FAIL)"

  # Test 10: Missing product_id in cart/update → 400
  R=$(curl -s -o /dev/null -w "%{http_code}" -X PUT http://localhost:19999/api/cart/update \
    -H "Content-Type: application/json" -d '{"quantity": 1}')
  check "Missing product_id in cart/update returns 400 (got $R)" "$([ "$R" = "400" ] && echo PASS || echo FAIL)"

  # Test 11: Non-existent product in cart/add → 404
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:19999/api/cart/add \
    -H "Content-Type: application/json" -d '{"product_id": "nonexistent_xyz"}')
  check "Non-existent product in cart/add returns 404 (got $R)" "$([ "$R" = "404" ] && echo PASS || echo FAIL)"
else
  echo "  WARN: Shop did not become healthy, skipping HTTP tests"
  FAIL=$((FAIL + 8))
fi

# Kill shop
kill $SHOP_PID 2>/dev/null || true
wait $SHOP_PID 2>/dev/null || true

# ---------------------------------------------------------------
# Test 12-16: Write-failure tests
# ---------------------------------------------------------------
echo "--- Test 12-16: Write-failure tests ---"

# Create a fresh data dir and start shop
mkdir -p "$TMPDIR/writefail/static/shop" "$TMPDIR/writefail/data"
cat > "$TMPDIR/writefail/static/shop/products.json" <<'PRODUCTS'
[{"id":"p1","title":"Test Widget","price":29.99,"rating":4.5,"rating_count":"(100)","image_url":"/img/widget.jpg"}]
PRODUCTS

# Start shop with fresh data dir
MOCK_PRODUCTS_PATH="$TMPDIR/writefail/static/shop/products.json" \
  MOCK_DATA_DIR="$TMPDIR/writefail/data" \
  bun run "$SHOP_SRC" --port 19998 >/dev/null 2>&1 &
WF_PID=$!

# Wait for healthy
WF_READY=false
for i in $(seq 1 15); do
  if curl -sf http://localhost:19998/health 2>/dev/null | grep -q "healthy"; then
    WF_READY=true
    break
  fi
  sleep 1
done

if [ "$WF_READY" = true ]; then
  # Seed writable state BEFORE locking the data dir
  curl -sf -X POST http://localhost:19998/api/cart/add \
    -H "Content-Type: application/json" -d '{"product_id": "p1"}' >/dev/null 2>&1 || true

  # Verify seed created the files
  if [ ! -f "$TMPDIR/writefail/data/mosi_shop_cart.json" ]; then
    echo "  FAIL: Cart seed did not create mosi_shop_cart.json"
    FAIL=$((FAIL + 5))
  else
    # Test 12: cart/remove should fail on saveCart
    chmod 444 "$TMPDIR/writefail/data/mosi_shop_cart.json"
    RESPONSE=$(curl -s -w '\nHTTP_CODE:%{http_code}' -X DELETE http://localhost:19998/api/cart/remove/p1 \
      -H "Content-Type: application/json" 2>/dev/null || echo "HTTP_CODE:000")
    BODY=$(echo "$RESPONSE" | sed '$d')
    STATUS=$(echo "$RESPONSE" | tail -1 | sed 's/HTTP_CODE://')
    if [ "$STATUS" = "500" ] && echo "$BODY" | grep -q '"error".*"Failed to save cart"'; then
      check "Write failure on cart/remove returns 500 with correct body" "PASS"
    else
      check "Write failure on cart/remove returns 500 with correct body" "FAIL (status: $STATUS, body: $BODY)"
    fi
    chmod 644 "$TMPDIR/writefail/data/mosi_shop_cart.json"

    # Test 13: user/update should fail on saveUser
    chmod 444 "$TMPDIR/writefail/data/mosi_shop_user.json"
    RESPONSE=$(curl -s -w '\nHTTP_CODE:%{http_code}' -X POST http://localhost:19998/api/user/update \
      -H "Content-Type: application/json" -d '{"field": "address", "value": "123 Main St"}' \
      2>/dev/null || echo "HTTP_CODE:000")
    BODY=$(echo "$RESPONSE" | sed '$d')
    STATUS=$(echo "$RESPONSE" | tail -1 | sed 's/HTTP_CODE://')
    if [ "$STATUS" = "500" ] && echo "$BODY" | grep -q '"error".*"Failed to save user profile"'; then
      check "Write failure on user/update returns 500 with correct body" "PASS"
    else
      check "Write failure on user/update returns 500 with correct body" "FAIL (status: $STATUS, body: $BODY)"
    fi
    chmod 644 "$TMPDIR/writefail/data/mosi_shop_user.json"

    # Test 14a: checkout should fail on saveOrders
    chmod 444 "$TMPDIR/writefail/data/mosi_shop_orders.json"
    RESPONSE=$(curl -s -w '\nHTTP_CODE:%{http_code}' -X POST http://localhost:19998/api/checkout \
      -H "Content-Type: application/json" -d '{}' \
      2>/dev/null || echo "HTTP_CODE:000")
    BODY=$(echo "$RESPONSE" | sed '$d')
    STATUS=$(echo "$RESPONSE" | tail -1 | sed 's/HTTP_CODE://')
    if [ "$STATUS" = "500" ] && echo "$BODY" | grep -q '"error".*"Failed to save order"'; then
      check "Write failure on checkout saveOrders returns 500 with correct body" "PASS"
    else
      check "Write failure on checkout saveOrders returns 500 with correct body" "FAIL (status: $STATUS, body: $BODY)"
    fi
    chmod 644 "$TMPDIR/writefail/data/mosi_shop_orders.json"

    # Test 14b: checkout clearCart after successful saveOrders
    chmod 444 "$TMPDIR/writefail/data/mosi_shop_cart.json"
    RESPONSE=$(curl -s -w '\nHTTP_CODE:%{http_code}' -X POST http://localhost:19998/api/checkout \
      -H "Content-Type: application/json" -d '{}' \
      2>/dev/null || echo "HTTP_CODE:000")
    BODY=$(echo "$RESPONSE" | sed '$d')
    STATUS=$(echo "$RESPONSE" | tail -1 | sed 's/HTTP_CODE://')
    if [ "$STATUS" = "500" ] && echo "$BODY" | grep -q '"error".*"Order saved but cart clear failed"'; then
      check "Write failure on checkout clearCart returns 500 with correct body" "PASS"
    else
      check "Write failure on checkout clearCart returns 500 with correct body" "FAIL (status: $STATUS, body: $BODY)"
    fi
    chmod 644 "$TMPDIR/writefail/data/mosi_shop_cart.json"

    # Test 15: cart/clear should fail on saveCart
    chmod 444 "$TMPDIR/writefail/data/mosi_shop_cart.json"
    RESPONSE=$(curl -s -w '\nHTTP_CODE:%{http_code}' -X POST http://localhost:19998/api/cart/clear \
      -H "Content-Type: application/json" 2>/dev/null || echo "HTTP_CODE:000")
    BODY=$(echo "$RESPONSE" | sed '$d')
    STATUS=$(echo "$RESPONSE" | tail -1 | sed 's/HTTP_CODE://')
    if [ "$STATUS" = "500" ] && echo "$BODY" | grep -q '"error".*"Failed to clear cart"'; then
      check "Write failure on cart/clear returns 500 with correct body" "PASS"
    else
      check "Write failure on cart/clear returns 500 with correct body" "FAIL (status: $STATUS, body: $BODY)"
    fi
    chmod 644 "$TMPDIR/writefail/data/mosi_shop_cart.json"
  fi
else
  echo "  FAIL: Write-failure shop did not become healthy, skipping write-failure tests"
  FAIL=$((FAIL + 5))
fi

# Cleanup
kill $WF_PID 2>/dev/null || true
wait $WF_PID 2>/dev/null || true

# ---------------------------------------------------------------
# Summary
# ---------------------------------------------------------------
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
echo "ALL CHECKS PASSED"
