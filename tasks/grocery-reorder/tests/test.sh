#!/bin/bash
# Harbor verifier wrapper - always writes reward files before exiting

# Ensure logs directory exists first
mkdir -p /logs/verifier

# Run the verifier and capture output WITHOUT set -e interfering
# Use || true to prevent non-zero exit from aborting the script
VERIFIER_OUTPUT=$(python3 /tests/verify.py 2>&1) || true
echo "$VERIFIER_OUTPUT"

# Extract score from output (format: "Score: X.XX/1.0")
SCORE=$(echo "$VERIFIER_OUTPUT" | grep -oP 'Score: \K[0-9]+\.[0-9]+' | head -1)

# Write reward.txt (required by Harbor verifier contract)
if [ -n "$SCORE" ]; then
    echo "$SCORE" > /logs/verifier/reward.txt
else
    echo "0.0" > /logs/verifier/reward.txt
fi

# Also write reward.json with dimension breakdown for debugging
# Pass verifier output via environment variable to avoid stdin/heredoc conflict
export VERIFIER_OUTPUT
python3 -c '
import json
import os
import re

# Read verifier output from environment variable
output = os.environ.get("VERIFIER_OUTPUT", "")

# Extract dimension results
dimensions = {}
for line in output.split("\n"):
    match = re.match(r"(D\d+).*: (PASS|FAIL|SKIPPED)", line)
    if match:
        dimensions[match.group(1)] = match.group(2)

# Extract score
score_match = re.search(r"Score: ([0-9]+\.[0-9]+)", output)
score = float(score_match.group(1)) if score_match else 0.0

# Write reward.json
reward_data = {
    "reward": score,
    "_meta_dimensions": dimensions
}

with open("/logs/verifier/reward.json", "w") as f:
    json.dump(reward_data, f, indent=2)
'

# Exit based on score threshold (use python3 instead of bc for container compatibility)
python3 -c "
import sys
score = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
sys.exit(0 if score >= 0.5 else 1)
" "$SCORE"
EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
    echo "Verification passed (score >= 0.5)"
else
    echo "Verification failed (score < 0.5)"
fi
exit $EXIT_CODE