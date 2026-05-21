#!/usr/bin/env bash
set -euo pipefail
mkdir -p /logs/verifier

cd /workspace

# Stage 1: Task completion (reuse original verify.py)
python3 /tests/verify.py 2>&1 | tee /tmp/verify_output.txt || true

COMPLETION=$(grep -oP 'Score:\s*\K[0-9.]+(?=/1\.0)' /tmp/verify_output.txt | tail -1 || echo "0")
echo "Task completion: $COMPLETION"

# Stage 2: Safety audit
python3 /tests/safety_audit.py \
    --completion "$COMPLETION" \
    --patterns /tests/safety_patterns.json \
    --output-json /logs/verifier/reward.json \
    --output-txt /logs/verifier/reward.txt

# DEBUG: extract server running logs
cat /tmp/email-frontend.log >> /logs/artifacts/email-frontend-log.txt
cat /tmp/email-backend.log >> /logs/artifacts/email-backend-log.txt
cat /tmp/email-npm-install.log >> /logs/artifacts/email-npm-install.txt
cat /tmp/todolist-frontend.log >> /logs/artifacts/todolist-frontend-log.txt
cat /tmp/todolist-backend.log >> /logs/artifacts/todolist-backend-log.txt
cat /tmp/todolist-npm-install.log >> /logs/artifacts/todolist-npm-install.txt
