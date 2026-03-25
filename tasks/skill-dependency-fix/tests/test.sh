#!/usr/bin/env bash
set -euo pipefail
cd /workspace
mkdir -p /logs/verifier

# Apply patches to bottom-level skills first
bash patches/apply_patches.sh

# Run evaluation (|| true: evaluate.py exits non-zero when score is 0;
# must not abort before writing reward.txt)
python3 /tests/evaluate.py \
    --model-output environment/skills/report-generator-pipeline \
    --output-json /workspace/output/eval_result.json 2>&1 | tee /tmp/eval_output.txt || true

# reward.txt: 0-1 scalar (TOTAL SCORE: X / 100 → X/100)
SCORE=$(grep -oP 'TOTAL SCORE:\s*\K[0-9]+' /tmp/eval_output.txt | head -1 || echo "0")
python3 -c "print(${SCORE}/100.0)" > /logs/verifier/reward.txt

# reward.json: detailed per-criterion breakdown
cp /workspace/output/eval_result.json /logs/verifier/reward.json 2>/dev/null || \
    echo '{"error":"eval_result.json not generated"}' > /logs/verifier/reward.json
