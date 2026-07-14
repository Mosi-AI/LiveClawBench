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

# reward.json: harbor-compliant schema ({reward: float, _meta_*: ...}).
# Issue #110 (B1): raw `cp eval_result.json reward.json` violates harbor's
# VerifierResult schema (top-level non-float keys without `_meta_` prefix).
python3 /tests/normalize_reward.py \
    --input /workspace/output/eval_result.json \
    --output /logs/verifier/reward.json \
    --reward "$(cat /logs/verifier/reward.txt)"
