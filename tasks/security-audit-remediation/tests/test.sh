#!/bin/bash
# test.sh — Verifier entry point for security-audit-remediation
# Runs verify.py and writes the score to /logs/verifier/reward.txt

set -e

mkdir -p /logs/verifier

echo "=== Running security audit remediation verifier ==="

# Run the verifier
cd /tests
python3 verify.py 2>&1 | tee /logs/verifier/output.log

# Extract the score from the last "Score:" line
SCORE=$(grep -oP 'Score:\s*\K[0-9.]+' /logs/verifier/output.log | tail -1)

if [ -z "$SCORE" ]; then
    echo "ERROR: Could not extract score from verifier output"
    SCORE="0.0"
fi

echo "$SCORE" > /logs/verifier/reward.txt
echo "Final score: $SCORE"

# Exit non-zero if score < 0.5 (following convention)
python3 -c "import sys; sys.exit(0 if float('$SCORE') >= 0.5 else 1)"
