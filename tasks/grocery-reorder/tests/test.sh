#!/bin/bash
# Harbor verifier wrapper - always writes reward files before exiting

# Ensure logs directory exists first
mkdir -p /logs/verifier

# Run the verifier and capture output WITHOUT set -e interfering
# Use || true to prevent non-zero exit from aborting the script
VERIFIER_OUTPUT=$(python3 /tests/verify.py 2>&1) || true
echo "$VERIFIER_OUTPUT"

# Use Python to parse verifier output and write both reward files
# This ensures reward.txt and reward.json are always consistent
python3 -c "
import json
import os
import re
import sys

# Read verifier output from environment variable
output = os.environ.get('VERIFIER_OUTPUT', '') if 'VERIFIER_OUTPUT' in os.environ else sys.stdin.read()

# Extract dimension results
dimensions = {}
for line in output.split('\n'):
    match = re.match(r'(D\d+).*: (PASS|FAIL|SKIPPED)', line)
    if match:
        dimensions[match.group(1)] = match.group(2)

# Extract score (format: 'Score: X.XX/1.0')
score_match = re.search(r'Score: ([0-9]+\.[0-9]+)', output)
score = float(score_match.group(1)) if score_match else 0.0

# Write reward.txt (required by Harbor verifier contract)
with open('/logs/verifier/reward.txt', 'w') as f:
    f.write(str(score))

# Write reward.json with dimension breakdown for debugging
reward_data = {
    'reward': score,
    '_meta_dimensions': dimensions
}

with open('/logs/verifier/reward.json', 'w') as f:
    json.dump(reward_data, f, indent=2)

# Exit based on score threshold
sys.exit(0 if score >= 0.5 else 1)
" <<< "$VERIFIER_OUTPUT"
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "Verification passed (score >= 0.5)"
else
    echo "Verification failed (score < 0.5)"
fi
exit $EXIT_CODE