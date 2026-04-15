#!/usr/bin/env bash
# Doc-search e2e verification — runs Bun doc-search mock, simulates agent
# browsing behavior, then runs deterministic_checks.py for both tasks.
#
# Usage (from mock-platform/):
#   bash docs/evidence/docsearch-e2e-verify.sh
#
# Output: docs/evidence/docsearch-task-outputs/<task>.txt

set -euo pipefail

EVIDENCE_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$EVIDENCE_DIR/docsearch-task-outputs"
REPO_ROOT="$(cd "$EVIDENCE_DIR/../../.." && pwd)"
TASKS_ROOT="$REPO_ROOT/tasks"
DOCSEARCH_PORT=19999

mkdir -p "$OUTPUT_DIR"

cleanup() {
  if [ -n "${DOCSEARCH_PID:-}" ]; then
    kill "$DOCSEARCH_PID" 2>/dev/null || true
    wait "$DOCSEARCH_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

run_task() {
  local task="$1"
  local sql_dir="$TASKS_ROOT/$task/environment/browser_mock_sidecar"
  local test_dir="/tmp/docsearch-e2e-$task"
  local output_file="$OUTPUT_DIR/$task.txt"

  echo "--- $task ---"
  echo "Starting doc-search mock..."
  rm -rf "$test_dir"
  mkdir -p "$test_dir"

  BROWSER_MOCK_DATA_DIR="$sql_dir" \
    bun run mocks/doc-search/src/index.ts \
    --port "$DOCSEARCH_PORT" \
    --database "$test_dir/browser_mock_documents.sqlite" \
    --log "$test_dir/access.jsonl" \
    > "$OUTPUT_DIR/docsearch-server.log" 2>&1 &
  DOCSEARCH_PID=$!
  sleep 2

  # Verify server is up
  local health
  health=$(curl -sf --max-time 5 "http://localhost:$DOCSEARCH_PORT/health")
  echo "Health: $health"

  # Verify metadata loaded
  local title
  title=$(curl -s --max-time 5 "http://localhost:$DOCSEARCH_PORT/" | grep -o '<title>[^<]*</title>')
  echo "Title: $title"

  # Simulate agent browsing: home → search → click → page
  echo "Simulating agent browsing..."
  curl -s --max-time 5 "http://localhost:$DOCSEARCH_PORT/" > /dev/null
  curl -s --max-time 5 "http://localhost:$DOCSEARCH_PORT/search?q=speculative+decoding" > /dev/null
  curl -s --max-time 5 "http://localhost:$DOCSEARCH_PORT/docs/speculative-decoding-exact-not-cache-only?sid=search_0001&rank=1" > /dev/null
  curl -s --max-time 5 "http://localhost:$DOCSEARCH_PORT/docs/self-speculative-decoding-update?sid=search_0001&rank=2" > /dev/null

  # Stop server
  kill "$DOCSEARCH_PID" 2>/dev/null; wait "$DOCSEARCH_PID" 2>/dev/null; DOCSEARCH_PID=""

  # Verify JSONL log
  echo ""
  echo "=== JSONL Access Log ==="
  cat "$test_dir/access.jsonl"
  echo ""

  # Run deterministic_checks.py
  local output_dir="$test_dir/output"
  mkdir -p "$output_dir"

  # Set up environment for deterministic_checks.py
  local workspace_dir="$test_dir/workspace"
  mkdir -p "$workspace_dir"

  # Create a minimal result.json (empty — browser trace is the key check)
  echo '{}' > "$output_dir/result.json"

  # Set the browser access log path
  export BROWSER_MOCK_ACCESS_LOG="$test_dir/access.jsonl"

  # Point HOME to test directory so deterministic_checks.py uses our paths
  local orig_home="$HOME"

  echo ""
  echo "=== Running deterministic_checks.py ==="
  {
    echo "# Task: $task"
    echo "# Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "# Mock: Bun doc-search on :$DOCSEARCH_PORT"
    echo "# SQL seed: $sql_dir/documents.sql"
    echo "# DB: $test_dir/browser_mock_documents.sqlite"
    echo "# JSONL log: $test_dir/access.jsonl"
    echo ""

    # Run browser_trace_score from deterministic_checks.py
    python3 -c "
import json
import sys
sys.path.insert(0, '$TASKS_ROOT/$task/tests')
from deterministic_checks import load_browser_events, browser_trace_score, load_json

events = load_browser_events(__import__('pathlib').Path('$test_dir/access.jsonl'))
key = load_json(__import__('pathlib').Path('$TASKS_ROOT/$task/tests/answer_key.json'))
trace_scores = browser_trace_score(key, events)
print(f'Browser trace events loaded: {len(events)}')
print(f'Browser trace score: {trace_scores}')
print(f'Events by type:')
from collections import Counter
for event_type, count in Counter(e.get('event') for e in events).items():
    print(f'  {event_type}: {count}')
"
  } | tee "$output_file"

  # Cleanup
  unset BROWSER_MOCK_ACCESS_LOG

  echo ""
  echo "Output saved to $output_file"
}

echo "========================================="
echo "Doc-Search E2E Verification — Bun Mock"
echo "========================================="
echo ""

run_task "conflict-repair-acb"
run_task "mixed-tool-memory"

echo "========================================="
echo "Doc-search verification complete."
echo "========================================="
