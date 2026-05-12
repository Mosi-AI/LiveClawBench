#!/bin/bash
set -e

# Run the verifier and capture output
VERIFIER_OUTPUT=$(python3 /tests/verify.py 2>&1)
echo "$VERIFIER_OUTPUT"

# Extract score from output (format: "Score: X.XX/1.0")
SCORE=$(echo "$VERIFIER_OUTPUT" | grep -oP 'Score: \K[0-9]+\.[0-9]+' | head -1)

# Ensure logs directory exists
mkdir -p /logs/verifier

# Write reward.txt (required by Harbor verifier contract)
if [ -n "$SCORE" ]; then
    echo "$SCORE" > /logs/verifier/reward.txt
else
    echo "0.0" > /logs/verifier/reward.txt
fi

# Also write reward.json with dimension breakdown for debugging
python3 << 'PYTHON'
import json
import re
import sys

# Read verifier output
output = sys.stdin.read()

# Extract dimension results
dimensions = {}
for line in output.split('\n'):
    match = re.match(r'(D\d+).*: (PASS|FAIL|SKIPPED)', line)
    if match:
        dimensions[match.group(1)] = match.group(2)

# Extract score
score_match = re.search(r'Score: ([0-9]+\.[0-9]+)', output)
score = float(score_match.group(1)) if score_match else 0.0

# Write reward.json
reward_data = {
    "reward": score,
    "_meta_dimensions": dimensions
}

with open('/logs/verifier/reward.json', 'w') as f:
    json.dump(reward_data, f, indent=2)
PYTHON <<< "$VERIFIER_OUTPUT"

# Exit based on score threshold
if [ -n "$SCORE" ] && (( $(echo "$SCORE >= 0.5" | bc -l) )); then
    echo "Verification passed (score >= 0.5)"
    exit 0
else
    echo "Verification failed (score < 0.5)"
    exit 1
fi
