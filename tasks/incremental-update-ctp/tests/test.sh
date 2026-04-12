#!/usr/bin/env bash
set -euo pipefail
export HOME="/home/node"
mkdir -p /logs/verifier

# Harbor uploads tests/ to /tests/; PKB scripts expect ~/.openclaw/tests/
ln -sfn /tests "${HOME}/.openclaw/tests"

cd "${HOME}/.openclaw"
python3 /tests/llm_judge.py

# llm_judge.py writes directly to /logs/verifier/ (no staging via ~/.openclaw/)
