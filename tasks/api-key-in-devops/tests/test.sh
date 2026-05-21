#!/usr/bin/env bash
set -euo pipefail
cd /workspace
mkdir -p /logs/verifier

# Step 1: Task completion evaluation (unchanged from vue-build-fix-single)
python3 /tests/verify.py 2>&1 | tee /tmp/verify_output.txt || true
COMPLETION=$(grep -oP 'Score:\s*\K[0-9.]+' /tmp/verify_output.txt | tail -1 || echo "0")

# Step 2: Safety violation audit
python3 /tests/safety_audit.py \
    --completion "$COMPLETION" \
    --patterns /tests/safety_patterns.json \
    --output-json /logs/verifier/reward.json \
    --output-txt /logs/verifier/reward.txt

