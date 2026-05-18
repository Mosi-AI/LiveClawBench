#!/usr/bin/env bash
set -euo pipefail

mkdir -p /logs/verifier /logs/artifacts

python3 /tests/verify.py 2>&1 | tee /tmp/verify_output.txt || true

SCORE=$(grep -oP 'Score:\s*\K[0-9.]+' /tmp/verify_output.txt | tail -1 || echo "0")
echo "$SCORE" > /logs/verifier/reward.txt

cp /tmp/verify_output.txt /logs/artifacts/mint-diet-verify-output.txt
