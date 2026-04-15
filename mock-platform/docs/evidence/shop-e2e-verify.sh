#!/usr/bin/env bash
# Shop verifier e2e harness — runs Bun mock shop, simulates agent actions,
# then runs verify.py for each task. Captures actual verifier output.
#
# Usage (from mock-platform/):
#   bash docs/evidence/shop-e2e-verify.sh
#
# Output: docs/evidence/shop-task-outputs/<task>.txt

set -euo pipefail

EVIDENCE_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$EVIDENCE_DIR/shop-task-outputs"
REPO_ROOT="$(cd "$EVIDENCE_DIR/../../.." && pwd)"
TASKS_ROOT="$REPO_ROOT/tasks"
PRODUCTS_SRC="$TASKS_ROOT/watch-shop/environment/shop-app/frontend/data/sample_products.json"
MOCK_PORT=19999
DATA_DIR="/tmp/shop-e2e-verify-data"
STATIC_DIR="/tmp/shop-e2e-static"
SHOP_SRC="mocks/shop/src/index.tsx"
ORIG_PRODUCTS_PATH="/opt/mock/static/shop/products.json"
LOCAL_PRODUCTS_PATH="/tmp/shop-e2e-static/shop/products.json"

mkdir -p "$OUTPUT_DIR"

# --- Setup static assets ---
mkdir -p "$STATIC_DIR/shop"
cp "$PRODUCTS_SRC" "$STATIC_DIR/shop/products.json"

# Patch products.json path in source for local testing
if ! grep -q "$LOCAL_PRODUCTS_PATH" "$SHOP_SRC" 2>/dev/null; then
  sed -i.bak "s|$ORIG_PRODUCTS_PATH|$LOCAL_PRODUCTS_PATH|g" "$SHOP_SRC"
  echo "Patched products path for local testing"
fi

cleanup() {
  stop_shop || true
  # Restore patched source
  if [ -f "$SHOP_SRC.bak" ]; then
    mv "$SHOP_SRC.bak" "$SHOP_SRC"
    echo "Restored original source"
  fi
}
trap cleanup EXIT

# --- Helper functions ---

start_shop() {
  echo "Starting Bun mock shop on :$MOCK_PORT..."
  rm -rf "$DATA_DIR"
  mkdir -p "$DATA_DIR"
  MOCK_DATA_DIR="$DATA_DIR" \
    bun run "$SHOP_SRC" \
    --port "$MOCK_PORT" \
    > "$OUTPUT_DIR/shop-server.log" 2>&1 &
  SHOP_PID=$!
  sleep 2
  # Verify shop is up
  curl -sf "http://localhost:$MOCK_PORT/health" > /dev/null || {
    echo "FAIL: shop not responding on :$MOCK_PORT"
    cat "$OUTPUT_DIR/shop-server.log"
    exit 1
  }
  echo "Shop started (PID=$SHOP_PID)"
}

stop_shop() {
  if [ -n "${SHOP_PID:-}" ]; then
    kill "$SHOP_PID" 2>/dev/null || true
    wait "$SHOP_PID" 2>/dev/null || true
    SHOP_PID=""
    echo "Shop stopped"
  fi
}

run_verify() {
  local task="$1"
  local verify_py="$TASKS_ROOT/$task/tests/verify.py"
  local output_file="$OUTPUT_DIR/$task.txt"

  # Create symlinks at /tmp/ so verify.py can find the data
  ln -sf "$DATA_DIR/mosi_shop_orders.json" /tmp/mosi_shop_orders.json
  ln -sf "$DATA_DIR/mosi_shop_cart.json" /tmp/mosi_shop_cart.json
  ln -sf "$DATA_DIR/mosi_shop_user.json" /tmp/mosi_shop_user.json

  echo "Running verify.py for $task..."
  {
    echo "# Task: $task"
    echo "# Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "# Mock: Bun shop on :$MOCK_PORT"
    echo "# Data dir: $DATA_DIR"
    echo ""
    python3 "$verify_py" 2>&1 || true
  } | tee "$output_file"

  echo ""
}

# --- Task-specific agent simulations ---

setup_watch_shop() {
  echo "Setting up watch-shop data..."
  curl -sf "http://localhost:$MOCK_PORT/search?q=smart+watch" > /dev/null
  curl -sf -X POST "http://localhost:$MOCK_PORT/api/cart/add" \
    -H "Content-Type: application/json" \
    -d '{"product_id":"prod_0068"}' > /dev/null
  curl -sf -X POST "http://localhost:$MOCK_PORT/api/checkout" > /dev/null
}

setup_washer_shop() {
  echo "Setting up washer-shop data..."
  curl -sf "http://localhost:$MOCK_PORT/search?q=washer" > /dev/null
  curl -sf -X POST "http://localhost:$MOCK_PORT/api/cart/add" \
    -H "Content-Type: application/json" \
    -d '{"product_id":"prod_0074"}' > /dev/null
  curl -sf -X POST "http://localhost:$MOCK_PORT/api/checkout" > /dev/null
}

setup_info_change() {
  echo "Setting up info-change data..."
  curl -sf -X POST "http://localhost:$MOCK_PORT/api/user/update" \
    -H "Content-Type: application/json" \
    -d '{"field":"address","value":"4278 Maple View Drive, Sacramento, CA 95814, USA"}' > /dev/null
  curl -sf -X POST "http://localhost:$MOCK_PORT/api/user/update" \
    -H "Content-Type: application/json" \
    -d '{"field":"phone","value":"12345678901"}' > /dev/null
}

setup_washer_change() {
  echo "Setting up washer-change data..."
  # Return ORD000005
  curl -sf -X POST "http://localhost:$MOCK_PORT/api/orders/ORD000005/return" > /dev/null
  # Buy prod_0074
  curl -sf -X POST "http://localhost:$MOCK_PORT/api/cart/add" \
    -H "Content-Type: application/json" \
    -d '{"product_id":"prod_0074"}' > /dev/null
  curl -sf -X POST "http://localhost:$MOCK_PORT/api/checkout" > /dev/null
}

# --- Main execution ---

echo "========================================="
echo "Shop E2E Verification — Bun Mock"
echo "========================================="
echo ""

# --- watch-shop ---
start_shop
setup_watch_shop
run_verify "watch-shop"
stop_shop

# --- washer-shop ---
start_shop
setup_washer_shop
run_verify "washer-shop"
stop_shop

# --- info-change ---
start_shop
setup_info_change
run_verify "info-change"
stop_shop

# --- washer-change ---
start_shop
setup_washer_change
run_verify "washer-change"
stop_shop

echo "========================================="
echo "All verifications complete."
echo "Output files in: $OUTPUT_DIR/"
echo "========================================="
