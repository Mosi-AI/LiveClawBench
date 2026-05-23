#!/bin/bash
set -e

mkdir -p /logs/verifier
set +e
python3 /tests/verify.py
status=$?
set -e
test -f /logs/verifier/reward.txt
test -f /logs/verifier/reward.json
exit "$status"
