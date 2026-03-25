#!/usr/bin/env bash
set -euo pipefail
cd /workspace
mkdir -p /logs/verifier

# This should output a json into /logs/verifier/reward.json
python3 /tests/verify.py || exit 1

