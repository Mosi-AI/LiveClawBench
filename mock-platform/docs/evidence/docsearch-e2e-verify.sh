#!/usr/bin/env bash
# Doc-search e2e verification — runs Bun doc-search mock, simulates agent
# browsing behavior, then runs the deterministic_checks.py pipeline.
#
# Two modes:
#   Mode A (default): Deterministic preview only.
#     Prints "DETERMINISTIC PREVIEW ONLY — not authoritative final reward" warning.
#     Runs structural_scores + browser_trace_score without LLM judge.
#   Mode B (JUDGE_BASE_URL + JUDGE_API_KEY set): Full verification.
#     Runs the complete llm_judge.py pipeline including LLM judge API call.
#     Output IS the authoritative reward.
#
# Usage (from mock-platform/):
#   bash docs/evidence/docsearch-e2e-verify.sh
#   JUDGE_BASE_URL=<url> JUDGE_API_KEY=<key> bash docs/evidence/docsearch-e2e-verify.sh

set -euo pipefail

EVIDENCE_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$EVIDENCE_DIR/docsearch-task-outputs"
REPO_ROOT="$(cd "$EVIDENCE_DIR/../../.." && pwd)"
TASKS_ROOT="$REPO_ROOT/tasks"
DOCSEARCH_PORT=19999
SCRIPT_DIR="$(pwd)"

mkdir -p "$OUTPUT_DIR"

# Detect mode
if [ -n "${JUDGE_BASE_URL:-}" ] && [ -n "${JUDGE_API_KEY:-}" ]; then
  MODE="full"
  echo "========================================="
  echo "Doc-Search E2E Verification — FULL MODE"
  echo "LLM judge API: $JUDGE_BASE_URL"
  echo "========================================="
else
  MODE="preview"
  echo "========================================="
  echo "Doc-Search E2E Verification — DETERMINISTIC PREVIEW ONLY"
  echo "WARNING: This is NOT the authoritative final reward."
  echo "The deterministic preview may differ from the full llm_judge.py run."
  echo "For authoritative results, run with JUDGE_BASE_URL + JUDGE_API_KEY."
  echo "See reward.json files in this directory for authoritative outputs."
  echo "========================================="
fi

cleanup() {
  if [ -n "${DOCSEARCH_PID:-}" ]; then
    kill "$DOCSEARCH_PID" 2>/dev/null || true
    wait "$DOCSEARCH_PID" 2>/dev/null || true
  fi
  cd "$SCRIPT_DIR"
}
trap cleanup EXIT

# Ensure clean port
lsof -ti:"$DOCSEARCH_PORT" | xargs kill -9 2>/dev/null || true

run_task() {
  local task="$1"
  local sql_dir="$TASKS_ROOT/$task/environment/browser_mock_sidecar"
  local test_dir="/tmp/docsearch-e2e-$task"
  local output_file="$OUTPUT_DIR/$task.txt"

  echo "--- $task ---"
  rm -rf "$test_dir"
  mkdir -p "$test_dir"

  # Start Bun doc-search mock with JSONL logging
  BROWSER_MOCK_DATA_DIR="$sql_dir" \
  BROWSER_MOCK_ACCESS_LOG="$test_dir/access.jsonl" \
    bun run mocks/doc-search/src/index.ts \
      --port "$DOCSEARCH_PORT" \
      --database "$test_dir/browser_mock_documents.sqlite" \
      --log "$test_dir/access.jsonl" \
      > "$OUTPUT_DIR/docsearch-server.log" 2>&1 &
  DOCSEARCH_PID=$!
  sleep 3

  # Verify server
  local health
  health=$(curl -sf --max-time 5 "http://localhost:$DOCSEARCH_PORT/health")
  echo "Health: $health"

  # Simulate agent browsing
  echo "Simulating agent browsing..."
  curl -sf --max-time 5 "http://localhost:$DOCSEARCH_PORT/" > /dev/null
  curl -sf --max-time 5 "http://localhost:$DOCSEARCH_PORT/search?q=speculative+decoding" > /dev/null

  if [ "$task" = "conflict-repair-acb" ]; then
    curl -sf --max-time 5 "http://localhost:$DOCSEARCH_PORT/docs/speculative-decoding-exact-not-cache-only?sid=search_0001&rank=1" > /dev/null
    curl -sf --max-time 5 "http://localhost:$DOCSEARCH_PORT/docs/speculative-decoding-speedup-condition?sid=search_0001&rank=2" > /dev/null
    curl -sf --max-time 5 "http://localhost:$DOCSEARCH_PORT/docs/self-speculative-decoding-update?sid=search_0001&rank=3" > /dev/null
  else
    curl -sf --max-time 5 "http://localhost:$DOCSEARCH_PORT/docs/speculative-decoding-exactness-note?sid=search_0001&rank=1" > /dev/null
    curl -sf --max-time 5 "http://localhost:$DOCSEARCH_PORT/docs/self-speculative-decoding-definition?sid=search_0001&rank=2" > /dev/null
    curl -sf --max-time 5 "http://localhost:$DOCSEARCH_PORT/docs/speculative-decoding-speedup-rule?sid=search_0001&rank=3" > /dev/null
    curl -sf --max-time 5 "http://localhost:$DOCSEARCH_PORT/docs/universal-assisted-decoding-note?sid=search_0001&rank=4" > /dev/null
    curl -sf --max-time 5 "http://localhost:$DOCSEARCH_PORT/docs/acceptance-alone-shortcut?sid=search_0001&rank=5" > /dev/null
    curl -sf --max-time 5 "http://localhost:$DOCSEARCH_PORT/docs/same-tokenizer-assumption-note?sid=search_0001&rank=6" > /dev/null
  fi

  # Stop server
  kill "$DOCSEARCH_PID" 2>/dev/null; wait "$DOCSEARCH_PID" 2>/dev/null; DOCSEARCH_PID=""

  # Show JSONL log
  echo ""
  echo "=== JSONL Access Log ==="
  cat "$test_dir/access.jsonl"
  echo ""

  # Set up deterministic_checks.py environment
  local output_dir="$test_dir/output"
  local workspace_dir="$test_dir/workspace"
  mkdir -p "$output_dir" "$workspace_dir"

  # Create a result.json (simulates agent output)
  echo '{}' > "$output_dir/result.json"

  # Run deterministic_checks.py
  echo ""
  if [ "$MODE" = "preview" ]; then
    echo "=== Running deterministic_checks.py (PREVIEW MODE) ==="
    echo "DETERMINISTIC PREVIEW ONLY — not authoritative final reward"
  else
    echo "=== Running deterministic_checks.py (FULL MODE) ==="
  fi

  {
    echo "# Task: $task"
    echo "# Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "# Mock: Bun doc-search on :$DOCSEARCH_PORT"
    echo "# SQL seed: $sql_dir/documents.sql"
    echo "# DB: $test_dir/browser_mock_documents.sqlite"
    echo "# JSONL log: $test_dir/access.jsonl"
    if [ "$MODE" = "preview" ]; then
      echo "# Mode: DETERMINISTIC PREVIEW ONLY"
    else
      echo "# Mode: Full (deterministic + LLM judge)"
    fi
    echo ""

    python3 -c "
import json
import sys
import os

# Set HOME to test dir so deterministic_checks resolves paths correctly
os.environ['HOME'] = '$test_dir/fake_home'
os.makedirs('$test_dir/fake_home/.openclaw/output', exist_ok=True)
os.makedirs('$test_dir/fake_home/.openclaw/workspace', exist_ok=True)

# Set BROWSER_MOCK_ACCESS_LOG so resolve_browser_log() finds the JSONL
os.environ['BROWSER_MOCK_ACCESS_LOG'] = '$test_dir/access.jsonl'

# Write result.json to expected location
with open('$test_dir/fake_home/.openclaw/output/result.json', 'w') as f:
    json.dump({}, f)

sys.path.insert(0, '$TASKS_ROOT/$task/tests')
from deterministic_checks import (
    load_json, load_browser_events, browser_trace_score,
    structural_scores, resolve_browser_log, KEY, OUT, weighted_sum
)

# Load rubric
rubric = load_json(__import__('pathlib').Path('$TASKS_ROOT/$task/tests/rubric.json'))

key = load_json(KEY)

# Use resolve_browser_log() to find the JSONL, matching production verifier logic
browser_log_path = resolve_browser_log()
events = load_browser_events(browser_log_path)

# Run all deterministic scores
scores = structural_scores(load_json(OUT / 'result.json'))

# Task-specific scoring
if '$task' == 'conflict-repair-acb':
    from deterministic_checks import repair_accuracy_score
    result = load_json(OUT / 'result.json')
    scores.update(repair_accuracy_score(result, key))
else:
    # mixed-tool-memory has database_integrity_score and query_accuracy_score
    try:
        from deterministic_checks import database_integrity_score, query_accuracy_score
        result = load_json(OUT / 'result.json')
        scores.update(database_integrity_score(key, result))
        scores.update(query_accuracy_score(key, result))
    except Exception as e:
        print(f'WARN: extended scoring needs more setup: {e}')

scores.update(browser_trace_score(key, events))

# Compute deterministic portion of final reward
det_reward = weighted_sum(scores, rubric)

print(f'Deterministic scores:')
for k, v in scores.items():
    print(f'  {k}: {v}')
print(f'Deterministic reward: {det_reward}')
print(f'Browser trace events loaded: {len(events)}')
print(f'Browser log resolved via: {browser_log_path}')

# Identify LLM-judged dimensions
llm_dims = {k: v for k, v in rubric.items() if k not in scores}
if llm_dims:
    print(f'LLM-judged dimensions (require JUDGE_BASE_URL): {list(llm_dims.keys())}')
    print(f'LLM-judged weight total: {sum(llm_dims.values())}')
"
  } 2>&1 | tee "$output_file"

  # Full mode: run llm_judge.py end-to-end
  if [ "$MODE" = "full" ]; then
    echo ""
    echo "=== Running full llm_judge.py ==="
    (
      export HOME="$test_dir/fake_home"
      export BROWSER_MOCK_ACCESS_LOG="$test_dir/access.jsonl"
      cd "$TASKS_ROOT/$task/tests"
      python3 llm_judge.py 2>&1 || echo "llm_judge.py failed (check logs above)"
    )
    echo "Full verifier output saved to $test_dir/fake_home/.openclaw/output/"
  fi

  echo ""
  echo "Output saved to $output_file"
}

echo ""

run_task "conflict-repair-acb"
echo ""
run_task "mixed-tool-memory"

echo ""
echo "========================================="
if [ "$MODE" = "preview" ]; then
  echo "Doc-search verification complete (DETERMINISTIC PREVIEW ONLY)."
  echo "For authoritative results, see reward.json files in this directory."
else
  echo "Doc-search verification complete (FULL MODE — authoritative)."
fi
echo "========================================="
