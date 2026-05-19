#!/usr/bin/env bash
set -euo pipefail

mkdir -p /logs/verifier /logs/artifacts

# Run verifier and capture both output and exit code
# Temporarily disable errexit so we can capture the exit code even if verify.py fails
set +e
python3 /tests/verify.py 2>&1 | tee /tmp/verify_output.txt
VERIFY_EXIT=${PIPESTATUS[0]}
set -e

# Extract score from output for reward.txt
SCORE=$(grep -oE 'Score:[[:space:]]*[0-9.]+' /tmp/verify_output.txt | tail -1 | grep -oE '[0-9.]+' || echo "0")
echo "$SCORE" > /logs/verifier/reward.txt

# Copy artifacts
cp /tmp/verify_output.txt /logs/artifacts/mint-diet-comprehensive-verify-output.txt

# Forward verify.py's original exit code
exit $VERIFY_EXIT
