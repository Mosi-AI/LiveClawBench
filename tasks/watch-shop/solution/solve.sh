#!/usr/bin/env bash
set -euo pipefail
cd /workspace

# Agent task:
# Please help me purchase a smart watch from the Mosi Shop (address: http://localhost:1234/, open it in your browser). The product must be the cheapest among those with a rating of 4.6 or higher. Please
openclaw agent --session-id test-001 -m "$(cat /workspace/instruction.md)" --json --timeout 300
