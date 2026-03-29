#!/usr/bin/env bash
set -euo pipefail
export HOME="/home/node"
mkdir -p /logs/verifier

# Harbor uploads tests/ to /tests/; PKB scripts expect ~/.openclaw/tests/
ln -sfn /tests "${HOME}/.openclaw/tests"

cd "${HOME}/.openclaw"
python3 /tests/llm_judge.py

# Copy reward files to harbor's expected location
cp -f "${HOME}/.openclaw/reward.json" /logs/verifier/reward.json 2>/dev/null || true
cp -f "${HOME}/.openclaw/reward.txt" /logs/verifier/reward.txt 2>/dev/null || true
