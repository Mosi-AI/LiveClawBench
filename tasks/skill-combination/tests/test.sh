#!/usr/bin/env bash
set -euo pipefail
cd /workspace
mkdir -p /logs/verifier

# Run evaluation (|| true: evaluate.py exits non-zero when score is 0;
# must not abort before writing reward.txt)
python3 /tests/evaluate.py \
    --model-output /workspace/model_response \
    --output-json /workspace/output/eval_result.json 2>&1 | tee /tmp/eval_output.txt || true

# reward.txt: 0-1 scalar (TOTAL: X / 85 → X/85)
SCORE=$(grep -oP 'TOTAL:\s*\K[0-9]+' /tmp/eval_output.txt | head -1 || echo "0")
MAX=$(grep -oP 'TOTAL:\s*[0-9]+\s*/\s*\K[0-9]+' /tmp/eval_output.txt | head -1 || echo "85")
python3 -c "print(${SCORE}/${MAX})" > /logs/verifier/reward.txt

# reward.json: harbor-compliant schema ({reward: float, _meta_*: ...}).
# Issue #110 (B1): raw `cp eval_result.json reward.json` violates harbor's
# VerifierResult schema (top-level non-float keys without `_meta_` prefix).
python3 /tests/normalize_reward.py \
    --input /workspace/output/eval_result.json \
    --output /logs/verifier/reward.json \
    --reward "$(cat /logs/verifier/reward.txt)"
