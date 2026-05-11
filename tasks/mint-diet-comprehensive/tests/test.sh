#!/usr/bin/env bash
set -euo pipefail

mkdir -p /logs/verifier /logs/artifacts

# Run verifier and capture exit code (don't fail on error yet)
python3 /tests/verify.py 2>&1 | tee /tmp/verify_output.txt || true

# Extract score from output
SCORE=$(grep -oP 'Score:\s*\K[0-9.]+' /tmp/verify_output.txt | tail -1 || echo "0")
echo "$SCORE" > /logs/verifier/reward.txt

# Copy artifacts
cp /tmp/verify_output.txt /logs/artifacts/mint-diet-comprehensive-verify-output.txt

# Forward verifier exit code: check if verify.py actually passed
# If score >= 0.5, exit 0; otherwise exit 1
if [[ "$(echo "$SCORE >= 0.5" | bc 2>/dev/null || echo "0")" == "1" ]]; then
    exit 0
else
    exit 1
fi
