#!/bin/bash
# Harbor verifier wrapper - always writes reward files before exiting

# Ensure logs directory exists first
mkdir -p /logs/verifier

# Run the verifier and capture output
# Use a temp file to capture output while preserving exit code
VERIFIER_OUTPUT_FILE=$(mktemp)
python3 /tests/verify.py 2>&1 | tee "$VERIFIER_OUTPUT_FILE"
VERIFY_EXIT_CODE=${PIPESTATUS[0]}

# Use Python to parse verifier output and write both reward files
# This ensures reward.txt and reward.json are always consistent
python3 -c "
import json
import re
import sys

# Read verifier output from file
with open(sys.argv[1], 'r') as f:
    output = f.read()

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
" "$VERIFIER_OUTPUT_FILE"

# Clean up temp file
rm -f "$VERIFIER_OUTPUT_FILE"

# Exit with verify.py's exit code (preserves mandatory D3/D4 gate)
exit $VERIFY_EXIT_CODE