#!/usr/bin/env bash
set -euo pipefail
mkdir -p /logs/verifier

cd /workspace
python3 /tests/verify.py 2>&1 | tee /tmp/verify_output.txt || true

# Extract score from "Score: X.XX/1.0" pattern
SCORE=$(grep -oP 'Score:\s*\K[0-9.]+' /tmp/verify_output.txt | tail -1 || echo "0")
echo "$SCORE" > /logs/verifier/reward.txt

# DEBUG: extract server running logs
cat /tmp/email-frontend.log >> /logs/artifacts/email-frontend-log.txt
cat /tmp/email-backend.log >> /logs/artifacts/email-backend-log.txt
cat /tmp/email-npm-install.log >> /logs/artifacts/email-npm-install.txt
cat /tmp/airline-frontend.log >> /logs/artifacts/airline-frontend-log.txt
cat /tmp/airline-backend.log >> /logs/artifacts/airline-backend-log.txt
cat /tmp/airline-npm-install.log >> /logs/artifacts/airline-npm-install.txt
