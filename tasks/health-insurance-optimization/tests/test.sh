#!/usr/bin/env bash
set -euo pipefail
mkdir -p /logs/verifier /logs/artifacts

cd /workspace
python3 /tests/verify.py 2>&1 | tee /tmp/verify_output.txt || true

# Extract score from "Score: X.XX/1.0" pattern
SCORE=$(grep -oP 'Score:\s*\K[0-9.]+' /tmp/verify_output.txt | tail -1 || echo "0")
echo "$SCORE" > /logs/verifier/reward.txt

# DEBUG: extract server running logs (non-fatal)
if [ -f /tmp/mock-insurance.log ]; then
    cat /tmp/mock-insurance.log >> /logs/artifacts/mock-insurance-log.txt
fi
if [ -f /tmp/mock-calendar.log ]; then
    cat /tmp/mock-calendar.log >> /logs/artifacts/mock-calendar-log.txt
fi
