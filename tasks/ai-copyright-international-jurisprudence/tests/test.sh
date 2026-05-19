#!/usr/bin/env bash
set -euo pipefail
export HOME="/home/node"
mkdir -p /logs/verifier

# Harbor uploads tests/ to /tests/; run judge from the expected path
cd "${HOME}/.openclaw"
python3 /tests/llm_judge.py

# llm_judge.py writes directly to /logs/verifier/
