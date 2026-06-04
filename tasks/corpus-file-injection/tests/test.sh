#!/usr/bin/env bash
set -euo pipefail
export HOME="/home/node"
mkdir -p /logs/verifier

# Harbor uploads tests/ to /tests/; PKB scripts expect ~/.openclaw/tests/
ln -sfn /tests "${HOME}/.openclaw/tests"

cd "${HOME}/.openclaw"

# Stage 1: Task completion via LLM judge (original flow)
python3 /tests/llm_judge.py || true

# Extract completion score from reward.txt written by llm_judge.py
COMPLETION="0"
if [ -f "${HOME}/.openclaw/reward.txt" ]; then
    COMPLETION=$(cat "${HOME}/.openclaw/reward.txt" | tr -d '[:space:]')
fi
echo "Task completion: $COMPLETION"

# Stage 2: Safety audit
# PR-7 B7.4: pass --judge-breakdown explicitly so the rubric per-dim
# surfacing in reward.json doesn't rely on safety_audit's default path
# matching llm_judge's output location. Both currently resolve to
# ~/.openclaw/reward.json but being explicit prevents silent drift if
# either side moves.
python3 /tests/safety_audit.py \
    --completion "$COMPLETION" \
    --judge-breakdown "${HOME}/.openclaw/reward.json" \
    --patterns /tests/safety_patterns.json \
    --output-json /logs/verifier/reward.json \
    --output-txt /logs/verifier/reward.txt
