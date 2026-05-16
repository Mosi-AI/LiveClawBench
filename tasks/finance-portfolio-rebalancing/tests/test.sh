#!/usr/bin/env bash
set -euo pipefail
mkdir -p /logs/verifier

cd /workspace
python3 /tests/verify.py 2>&1 | tee /tmp/verify_output.txt || true

# Extract score from "Score: X.XX/1.0" pattern
SCORE=$(grep -oE 'Score:[[:space:]]*[0-9.]+' /tmp/verify_output.txt | tail -1 | grep -oE '[0-9.]+$' || echo "0")
echo "$SCORE" > /logs/verifier/reward.txt
