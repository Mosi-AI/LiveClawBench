#!/usr/bin/env bash
set -euo pipefail
export HOME="/home/node"
mkdir -p /logs/verifier

ln -sfn /tests "${HOME}/.openclaw/tests"

cd "${HOME}/.openclaw"
python3 /tests/llm_judge.py
