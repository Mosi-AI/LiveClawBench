#!/usr/bin/env bash
# `|| true` is critical: verify.py exits non-zero when score < 0.5, but we
# still need reward.txt written; without it harbor falls back to reward.json
# (multi-key) which trips its single-key Mean metric.

set -uo pipefail
mkdir -p /logs/verifier

python3 /tests/verify.py 2>&1 | tee /logs/verifier/verify_stdout.txt || true
SCORE=$(grep -oP 'Score:\s*\K[0-9.]+' /logs/verifier/verify_stdout.txt | tail -1 || echo "0")
echo "${SCORE:-0.0}" > /logs/verifier/reward.txt
echo "Verification score: ${SCORE:-0.0}"
