#!/usr/bin/env bash
set -euo pipefail
cd /workspace
mkdir -p /logs/verifier

# Run evaluation (|| true: evaluate.py exits non-zero when score is 0;
# must not abort before writing reward.txt)
python3 /tests/evaluate.py \
    --model-output /workspace/model_response \
    --output-json /workspace/output/eval_result.json 2>&1 | tee /tmp/eval_output.txt || true

# Extract score: "TOTAL: X / 100" → X/100 as float
SCORE=$(grep -oP 'TOTAL:\s*\K[0-9]+' /tmp/eval_output.txt | head -1 || echo "0")
python3 -c "print(${SCORE}/100.0)" > /logs/verifier/reward.txt
