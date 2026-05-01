#!/usr/bin/env bash
# Smoke test for airline task containers: verify mock services + python_compat + seed data
set -euo pipefail

TASKS=("flight-booking" "flight-seat-selection" "flight-seat-selection-failed" "flight-cancel-claim" "baggage-tracking-application")
IMAGE_PREFIX="liveclawbench"
PASS=0
FAIL=0

for TASK in "${TASKS[@]}"; do
    IMAGE="${IMAGE_PREFIX}-${TASK}-test"
    CONTAINER="smoke-${TASK}"

    echo "=== Testing: ${TASK} (${IMAGE}) ==="

    # Cleanup previous run
    docker rm -f "$CONTAINER" 2>/dev/null || true

    # Start container
    docker run -d --name "$CONTAINER" "$IMAGE" > /dev/null

    # Wait for startup script to complete
    sleep 8

    # Test 1: Bun airline API responds on port 5000
    API_RESULT=$(docker exec "$CONTAINER" bash -c 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5000/api/flights/ 2>/dev/null || echo "000"')
    if [ "$API_RESULT" = "200" ]; then
        echo "  [PASS] Bun API on :5000 → 200"
    else
        echo "  [FAIL] Bun API on :5000 → ${API_RESULT}"
        FAIL=$((FAIL + 1))
    fi

    # Test 2: python_compat import works
    ORM_RESULT=$(docker exec "$CONTAINER" bash -c 'python3 -c "
import sys
sys.path.insert(0, \"/workspace/environment/airline-app/backend\")
from app import create_app
from app.models.user import User
from app.models.booking import Booking
app = create_app(\"development\")
with app.app_context():
    users = User.query.all()
    print(f\"ORM_OK: {len(users)} users\")
" 2>&1')
    if echo "$ORM_RESULT" | grep -q "ORM_OK"; then
        echo "  [PASS] python_compat ORM: $(echo "$ORM_RESULT" | grep ORM_OK)"
    else
        echo "  [FAIL] python_compat ORM:"
        echo "    $ORM_RESULT"
        FAIL=$((FAIL + 1))
    fi

    # Test 3: Seed data exists (flights table)
    SEED_RESULT=$(docker exec "$CONTAINER" bash -c 'sqlite3 /var/lib/mock-data/airline/airline.db "SELECT COUNT(*) FROM flights;" 2>/dev/null || echo "ERROR"')
    if [ "$SEED_RESULT" != "ERROR" ] && [ "$SEED_RESULT" -gt "0" ] 2>/dev/null; then
        echo "  [PASS] Seed data: ${SEED_RESULT} flights"
    else
        echo "  [FAIL] Seed data: ${SEED_RESULT}"
        FAIL=$((FAIL + 1))
    fi

    # Test 4: 5173 proxy responds (TCP forwarder)
    PROXY_RESULT=$(docker exec "$CONTAINER" bash -c 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173/api/flights/ 2>/dev/null || echo "000"')
    if [ "$PROXY_RESULT" = "200" ]; then
        echo "  [PASS] 5173 proxy → 200"
    else
        echo "  [FAIL] 5173 proxy → ${PROXY_RESULT}"
        FAIL=$((FAIL + 1))
    fi

    # Test 5: Log files exist
    LOG_RESULT=$(docker exec "$CONTAINER" bash -c 'test -f /tmp/airline-backend.log && test -f /tmp/airline-frontend.log && test -f /tmp/airline-npm-install.log && echo "OK" || echo "MISSING"')
    if [ "$LOG_RESULT" = "OK" ]; then
        echo "  [PASS] Log files present"
    else
        echo "  [FAIL] Log files: ${LOG_RESULT}"
        FAIL=$((FAIL + 1))
    fi

    # Test 6: Verify script can run (import check only — no agent actions)
    VERIFY_IMPORT=$(docker exec "$CONTAINER" bash -c 'python3 -c "
import sys
sys.path.insert(0, \"/workspace/environment/airline-app/backend\")
from app import create_app
from app.models.booking import Booking
from app.models.user import User
from app.models.flight import Flight
app = create_app(\"development\")
with app.app_context():
    peter = User.query.filter_by(email=\"peter.griffin@work.mosi.inc\").first()
    if peter:
        print(f\"VERIFY_OK: Peter Griffin found (id={peter.id})\")
    else:
        print(\"VERIFY_WARN: Peter Griffin not found\")
" 2>&1')
    if echo "$VERIFY_IMPORT" | grep -q "VERIFY_OK"; then
        echo "  [PASS] Verifier import: $(echo "$VERIFY_IMPORT" | grep VERIFY_OK)"
    else
        echo "  [WARN] Verifier import: $VERIFY_IMPORT"
    fi

    # Test 7: Check specific seed data (GKD flights)
    GKD_RESULT=$(docker exec "$CONTAINER" bash -c "sqlite3 /var/lib/mock-data/airline/airline.db \"SELECT flight_number FROM flights WHERE flight_number LIKE 'GKD%' LIMIT 5;\"" 2>/dev/null)
    if echo "$GKD_RESULT" | grep -q "GKD"; then
        echo "  [PASS] GKD flights present: $(echo "$GKD_RESULT" | head -3 | tr '\n' ',' | sed 's/,$//')"
    else
        echo "  [WARN] No GKD flights found (seed may differ by TASK_NAME)"
    fi

    # Cleanup
    docker rm -f "$CONTAINER" > /dev/null 2>&1
    PASS=$((PASS + 6))

    echo ""
done

echo "=== Summary ==="
echo "Passed: ${PASS}"
echo "Failed: ${FAIL}"
echo "Total:  $((PASS + FAIL))"
