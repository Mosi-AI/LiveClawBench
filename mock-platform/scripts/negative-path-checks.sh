#!/bin/bash
# negative-path-checks.sh — AC-7 targeted fail-fast and error-handling checks
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
  for pid in ${SHOP_PID:-} ${DOC_PID:-} ; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  rm -rf "${TMPDIR:-}"
}
trap cleanup EXIT

TMPDIR=$(mktemp -d)
SHOP_SRC="$MOCK_PLATFORM/mocks/shop/src/index.tsx"
DOC_SRC="$MOCK_PLATFORM/mocks/doc-search/src/index.ts"

echo "=== Negative-Path Checks ==="
echo "Temp dir: $TMPDIR"
echo ""

# ---------------------------------------------------------------
# Test 1: Corrupted products.json → exit non-zero (AC-7)
# ---------------------------------------------------------------
echo "--- Test 1: Corrupted products.json → exit non-zero ---"
mkdir -p "$TMPDIR/corrupt/static/shop"
echo "NOT JSON" > "$TMPDIR/corrupt/static/shop/products.json"
RC=0
MOCK_PRODUCTS_PATH="$TMPDIR/corrupt/static/shop/products.json" \
  MOCK_DATA_DIR="$TMPDIR/corrupt/data" \
  timeout 5 bun run "$SHOP_SRC" --port 19001 >/dev/null 2>&1 || RC=$?
check "Corrupted products.json exits non-zero (rc=$RC)" "$([ "$RC" -ne 0 ] && echo PASS || echo FAIL)"

# ---------------------------------------------------------------
# Test 2: Missing products.json → exit non-zero (AC-7)
# ---------------------------------------------------------------
echo "--- Test 2: Missing products.json → exit non-zero ---"
mkdir -p "$TMPDIR/missing/static/shop"
RC=0
MOCK_PRODUCTS_PATH="$TMPDIR/missing/static/shop/products.json" \
  MOCK_DATA_DIR="$TMPDIR/missing/data" \
  timeout 5 bun run "$SHOP_SRC" --port 19002 >/dev/null 2>&1 || RC=$?
check "Missing products.json exits non-zero (rc=$RC)" "$([ "$RC" -ne 0 ] && echo PASS || echo FAIL)"

# ---------------------------------------------------------------
# Test 3: Missing SQL seed for doc-search → exit non-zero (AC-7)
# ---------------------------------------------------------------
echo "--- Test 3: Doc-search missing SQL seed → exit non-zero ---"
mkdir -p "$TMPDIR/docsearch-missing"
RC=0
BROWSER_MOCK_DATA_DIR="$TMPDIR/docsearch-missing" \
  HOME="$TMPDIR/docsearch-missing" \
  timeout 5 bun run "$DOC_SRC" --port 19003 >/dev/null 2>&1 || RC=$?
check "Missing SQL seed exits non-zero (rc=$RC)" "$([ "$RC" -ne 0 ] && echo PASS || echo FAIL)"

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
# Summary
# ---------------------------------------------------------------
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
echo "ALL CHECKS PASSED"
