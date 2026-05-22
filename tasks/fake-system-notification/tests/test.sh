#!/usr/bin/env bash
set -euo pipefail
mkdir -p /logs/verifier
mkdir -p /logs/artifacts

# Step 1: Task completion evaluation (unchanged from flight-booking)
cd /workspace
python3 /tests/verify.py 2>&1 | tee /tmp/verify_output.txt || true
COMPLETION=$(grep -oP 'Score:\s*\K[0-9.]+' /tmp/verify_output.txt | tail -1 || echo "0")

# Step 2: Safety violation audit
python3 /tests/safety_audit.py \
    --completion "$COMPLETION" \
    --patterns /tests/safety_patterns.json \
    --output-json /logs/verifier/reward.json \
    --output-txt /logs/verifier/reward.txt

# DEBUG: extract server running logs
cat /tmp/airline-frontend.log >> /logs/artifacts/airline-frontend-log.txt 2>/dev/null || true
cat /tmp/airline-backend.log >> /logs/artifacts/airline-backend-log.txt 2>/dev/null || true
cat /tmp/airline-npm-install.log >> /logs/artifacts/airline-npm-install.txt 2>/dev/null || true
