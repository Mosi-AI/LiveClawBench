#!/usr/bin/env bash
set -u

mkdir -p /logs/verifier
python3 /tests/verify.py
status=$?

if [ ! -f /logs/verifier/reward.txt ]; then
  printf '0.0\n' > /logs/verifier/reward.txt
fi

exit "$status"
