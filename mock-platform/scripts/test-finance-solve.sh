#!/usr/bin/env bash
# Integration test: build task image, run solve.sh, run verifier, check score
# Usage: ./test-finance-solve.sh <task-name>
set -euo pipefail

TASK="$1"
WORKTREE="$(cd "$(dirname "$0")/../.." && pwd)"
TASK_DIR="${WORKTREE}/tasks/${TASK}"
OUTPUT_DIR="/tmp/finance-test-output/${TASK}"
mkdir -p "$OUTPUT_DIR"

echo "=== Testing ${TASK} ==="

# 1. Build the task image from its Dockerfile
IMAGE_TAG="liveclawbench-${TASK}:test"
echo "Building task image..."
docker build -t "$IMAGE_TAG" -f "${TASK_DIR}/environment/Dockerfile" "${TASK_DIR}/environment/" > "${OUTPUT_DIR}/build.log" 2>&1
echo "Build OK"

# 2. Start container with entrypoint + sleep infinity
CONTAINER=$(docker run -d --rm \
  -e TASK_NAME="${TASK}" \
  -v "${TASK_DIR}/tests:/tests:ro" \
  -v "${TASK_DIR}/solution:/workspace/solution:ro" \
  -v "${TASK_DIR}/instruction.md:/workspace/instruction.md:ro" \
  "${IMAGE_TAG}" \
  sleep infinity)

echo "Container: ${CONTAINER}"

cleanup() {
  docker stop "$CONTAINER" > /dev/null 2>&1 || true
}
trap cleanup EXIT

# 3. Wait for mocks to start
echo "Waiting for mocks..."
sleep 10

# Check container is running
if [ -z "$(docker ps -q -f "id=${CONTAINER}")" ]; then
  echo "FAIL: Container exited during startup"
  docker logs "$CONTAINER" > "${OUTPUT_DIR}/startup.log" 2>&1 || true
  cat "${OUTPUT_DIR}/startup.log"
  exit 1
fi

# 4. Check finance mock health
echo "Checking finance mock health..."
HEALTH=$(docker exec "$CONTAINER" sh -c 'curl -sf http://localhost:1235/health 2>/dev/null || echo "UNREACHABLE"')
echo "Health: $HEALTH"
if echo "$HEALTH" | grep -q "UNREACHABLE"; then
  echo "FAIL: Finance mock not reachable"
  docker logs "$CONTAINER" > "${OUTPUT_DIR}/mock.log" 2>&1 || true
  tail -20 "${OUTPUT_DIR}/mock.log"
  exit 1
fi

# 5. Run solve.sh
echo "Running solve.sh..."
set +e
docker exec "$CONTAINER" sh -c 'cd /workspace && bash /workspace/solution/solve.sh' > "${OUTPUT_DIR}/solve.log" 2>&1
SOLVE_EXIT=$?
set -e
echo "solve.sh exit code: ${SOLVE_EXIT}"
cat "${OUTPUT_DIR}/solve.log"

# 6. Run verifier via test.sh
echo "Running verifier..."
set +e
docker exec "$CONTAINER" sh -c 'mkdir -p /logs/verifier && cd /workspace && /tests/test.sh' > "${OUTPUT_DIR}/verify.log" 2>&1
VERIFY_EXIT=$?
set -e
echo "verifier exit code: ${VERIFY_EXIT}"
cat "${OUTPUT_DIR}/verify.log"

# 7. Extract score
if docker cp "${CONTAINER}:/logs/verifier/reward.txt" "${OUTPUT_DIR}/reward.txt" 2>/dev/null; then
  SCORE=$(cat "${OUTPUT_DIR}/reward.txt" | tr -d '[:space:]')
else
  SCORE=$(grep -oE 'Score:[[:space:]]*[0-9.]+' "${OUTPUT_DIR}/verify.log" | tail -1 | grep -oE '[0-9.]+$' || echo "0")
fi

echo "=== ${TASK}: Score=${SCORE} ==="
echo ""
