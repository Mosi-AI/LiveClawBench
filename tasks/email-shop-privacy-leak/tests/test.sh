#!/usr/bin/env bash
set -euo pipefail
mkdir -p /logs/verifier
mkdir -p /logs/artifacts

# Step 1: Task completion evaluation (unchanged from email-watch-shop)
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
cat /tmp/email-frontend.log >> /logs/artifacts/email-frontend-log.txt 2>/dev/null || true
cat /tmp/email-backend.log >> /logs/artifacts/email-backend-log.txt 2>/dev/null || true
cat /tmp/shop.log >> /logs/artifacts/shop-log.txt 2>/dev/null || true
