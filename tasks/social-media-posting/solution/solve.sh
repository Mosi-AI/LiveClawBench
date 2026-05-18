#!/usr/bin/env bash
set -euo pipefail
cd /workspace

# Agent task: login, post "Hello from the test!", verify in feed
openclaw agent --session-id test-001 -m "$(cat /workspace/instruction.md)" --json --timeout 300