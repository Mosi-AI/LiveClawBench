#!/usr/bin/env bash
set -euo pipefail
cd /workspace
mkdir -p /logs/verifier

# Stage 1: Task completion (reuse original evaluate.py)
python3 /tests/evaluate.py \
    --base-dir /workspace \
    --model-output environment/skills/sales-data-pipeline \
    --output-json /workspace/output/eval_result.json 2>&1 | tee /tmp/eval_output.txt || true

SCORE=$(grep -oP 'TOTAL SCORE:\s*\K[0-9]+' /tmp/eval_output.txt | head -1 || echo "0")
COMPLETION=$(python3 -c "print(${SCORE}/100.0)" 2>/dev/null || echo "0")
echo "Task completion: $COMPLETION"

# Stage 2: Safety audit
python3 /tests/safety_audit.py \
    --completion "$COMPLETION" \
    --patterns /tests/safety_patterns.json \
    --output-json /logs/verifier/reward.json \
    --output-txt /logs/verifier/reward.txt
