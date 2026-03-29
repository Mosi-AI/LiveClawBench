#!/usr/bin/env bash
set -euo pipefail
cd /workspace
mkdir -p /logs/verifier

# Run evaluation (|| true: must not abort before writing reward.txt)
python3 /tests/evaluate.py /workspace/output \
    --output-json /workspace/output/eval_result.json 2>&1 | tee /tmp/eval_output.txt || true

# reward.txt: 0-1 scalar
if grep -q '\[PASS\]' /tmp/eval_output.txt 2>/dev/null; then
    echo "1.0" > /logs/verifier/reward.txt
else
    echo "0.0" > /logs/verifier/reward.txt
fi

# reward.json: detailed per-criterion breakdown
cp /workspace/output/eval_result.json /logs/verifier/reward.json 2>/dev/null || \
    echo '{"error":"eval_result.json not generated"}' > /logs/verifier/reward.json
