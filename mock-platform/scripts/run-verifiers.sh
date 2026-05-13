#!/bin/bash
# Run verifier for an airline task inside a Docker container
# Usage: ./run-verifiers.sh <task-name> <image-tag> [output-dir]
# Mounts the task's tests/ directory into /tests/ in the container.
# output-dir defaults to /tmp/verifier-output; results go to <output-dir>/<task-name>/
#
# Runs /tests/test.sh (the real task harness) instead of direct verify.py.
# Copies /logs/verifier/reward.txt out of the container after completion.

set -euo pipefail

TASK="$1"
IMAGE="$2"
OUTPUT_DIR="${3:-/tmp/verifier-output}"
TASK_DIR="tasks/${TASK}"
OUTPUT_DIR="${OUTPUT_DIR}/${TASK}"
mkdir -p "$OUTPUT_DIR"

echo "=== Running verifier for ${TASK} ==="

# Start container with tests mounted and startup
CONTAINER=$(docker run -d --rm \
  -e TASK_NAME="${TASK}" \
  -e PYTHONPATH=/workspace/environment/airline-app/backend \
  -v "$(pwd)/${TASK_DIR}/tests:/tests:ro" \
  -v "$(pwd)/${TASK_DIR}/instruction.md:/workspace/instruction.md:ro" \
  "${IMAGE}" \
  sh -c '/opt/mock/entrypoint.sh sleep infinity')

echo "Container: ${CONTAINER}"

# Wait for startup to complete (mock services, DB seeding, etc.)
echo "Waiting for startup to complete..."
sleep 15

# Check if container is still running
if ! docker ps -q -f "id=${CONTAINER}" | grep -q .; then
  echo "FAIL: Container exited during startup"
  docker logs "$CONTAINER" > "${OUTPUT_DIR}/startup-log.txt" 2>&1 || true
  echo "0.0" > "${OUTPUT_DIR}/reward.txt"
  echo "STARTUP_FAILED" > "${OUTPUT_DIR}/status.txt"
  exit 1
fi

# Check API health
echo "Checking API health..."
if docker exec "$CONTAINER" sh -c 'curl -sf http://127.0.0.1:5000/api/flights' > "${OUTPUT_DIR}/api-flights-response.json" 2>/dev/null; then
  echo "API OK" > "${OUTPUT_DIR}/api-status.txt"
else
  echo "API not accessible" > "${OUTPUT_DIR}/api-status.txt"
fi

# Check python_compat bridge
echo "Checking python_compat bridge..."
docker exec "$CONTAINER" sh -c 'python3 -c "import sys; sys.path.insert(0, \"/workspace/environment/airline-app/backend\"); from app import create_app; app = create_app(\"development\"); print(\"python_compat OK\")"' > "${OUTPUT_DIR}/python_compat.txt" 2>&1 || echo "python_compat FAILED" >> "${OUTPUT_DIR}/python_compat.txt"

# Check DB has seeded data
echo "Checking DB seeding..."
docker exec "$CONTAINER" sh -c 'sqlite3 /var/lib/mock-data/airline/airline.db "SELECT COUNT(*) FROM flights"' > "${OUTPUT_DIR}/db-flights-count.txt" 2>&1 || echo "DB query failed" >> "${OUTPUT_DIR}/db-flights-count.txt"
docker exec "$CONTAINER" sh -c 'sqlite3 /var/lib/mock-data/airline/airline.db "SELECT COUNT(*) FROM bookings"' > "${OUTPUT_DIR}/db-bookings-count.txt" 2>&1 || echo "DB query failed" >> "${OUTPUT_DIR}/db-bookings-count.txt"

# Run the verifier via test.sh (the real task harness)
# test.sh calls verify.py and writes /logs/verifier/reward.txt
echo "Running verifier via /tests/test.sh..."
docker exec "$CONTAINER" sh -c 'mkdir -p /logs/verifier /logs/artifacts && cd /workspace && /tests/test.sh' > "${OUTPUT_DIR}/test-sh-output.txt" 2>&1
TEST_EXIT=$?
echo "test.sh exit code: ${TEST_EXIT}" > "${OUTPUT_DIR}/test-sh-exit-code.txt"

# Copy reward.txt from container (the authoritative score)
echo "Copying reward.txt from container..."
if docker cp "${CONTAINER}:/logs/verifier/reward.txt" "${OUTPUT_DIR}/reward.txt" 2>/dev/null; then
  SCORE=$(cat "${OUTPUT_DIR}/reward.txt" | tr -d '[:space:]')
  echo "Reward from container: ${SCORE}"
else
  echo "No reward.txt in container" > "${OUTPUT_DIR}/reward-container.txt"
  # Fallback: try to extract score from test.sh output
  SCORE=$(grep -o 'Score:[[:space:]]*[0-9.]*' "${OUTPUT_DIR}/test-sh-output.txt" | tail -1 | grep -o '[0-9.]*$' || echo "0")
  echo "$SCORE" > "${OUTPUT_DIR}/reward.txt"
fi

# Copy verifier artifacts if they exist
docker cp "${CONTAINER}:/logs/verifier/." "${OUTPUT_DIR}/verifier-logs/" 2>/dev/null || true
docker cp "${CONTAINER}:/logs/artifacts/." "${OUTPUT_DIR}/artifacts/" 2>/dev/null || true

echo "=== ${TASK}: Score=${SCORE} ==="
echo ""

# Stop container
docker stop "$CONTAINER" > /dev/null 2>&1 || true

echo "Verifier output saved to ${OUTPUT_DIR}/"
