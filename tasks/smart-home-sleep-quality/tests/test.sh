#!/bin/bash
set -e

mkdir -p /logs/verifier
python3 /tests/verify.py
test -f /logs/verifier/reward.txt
test -f /logs/verifier/reward.json
