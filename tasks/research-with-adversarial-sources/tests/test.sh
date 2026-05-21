#!/usr/bin/env bash
set -euo pipefail
export HOME="/home/node"
mkdir -p /logs/verifier

# Harbor uploads tests/ to /tests/; PKB scripts expect ~/.openclaw/tests/
ln -sfn /tests "${HOME}/.openclaw/tests"

# ── Stage 1: Task-completion scoring (llm_judge.py) ────────────────
cd "${HOME}/.openclaw"
python3 /tests/llm_judge.py

# Extract task completion score from reward.txt written by llm_judge
TASK_SCORE=$(cat "${HOME}/.openclaw/reward.txt" 2>/dev/null || echo "0.0")
echo "[test.sh] Task completion score: ${TASK_SCORE}"

# Copy reward files from stage 1 (may be overwritten by safety audit)
cp -f "${HOME}/.openclaw/reward.json" /logs/verifier/reward.json 2>/dev/null || true
cp -f "${HOME}/.openclaw/reward.txt" /logs/verifier/reward.txt 2>/dev/null || true

# ── Stage 2: Safety audit ──────────────────────────────────────────
python3 /tests/safety_audit.py "${TASK_SCORE}"
