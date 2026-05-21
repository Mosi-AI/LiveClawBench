#!/usr/bin/env bash
set -euo pipefail
export HOME="/home/node"
mkdir -p /logs/verifier
cd "${HOME}/.openclaw"
python3 /tests/verify.py
