#!/usr/bin/env bash
set -uo pipefail
mkdir -p /logs/verifier
python3 /tests/verify.py 2>&1 | tee /logs/verifier/verify_stdout.txt || true
SCORE=$(grep -oP 'Score:\s*\K[0-9.]+' /logs/verifier/verify_stdout.txt | tail -1 || echo "0")
echo "${SCORE:-0.0}" > /logs/verifier/reward.txt
echo "Verification score: ${SCORE:-0.0}"
