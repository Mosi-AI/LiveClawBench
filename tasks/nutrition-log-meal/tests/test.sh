#!/usr/bin/env bash
set -euo pipefail

mkdir -p /logs/verifier /logs/artifacts

set +e
python3 /tests/verify.py 2>&1 | tee /tmp/verify_output.txt
VERIFY_EXIT=${PIPESTATUS[0]}
set -e

SCORE=$(grep -oE 'Score:[[:space:]]*[0-9.]+' /tmp/verify_output.txt | tail -1 | grep -oE '[0-9.]+' || echo "0")
echo "$SCORE" > /logs/verifier/reward.txt

cp /tmp/verify_output.txt /logs/artifacts/nutrition-log-meal-verify-output.txt

exit $VERIFY_EXIT
