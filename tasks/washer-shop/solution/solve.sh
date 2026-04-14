#!/usr/bin/env bash
set -euo pipefail
cd /workspace

# Agent task:
# Please help me purchase a washer from the Mosi Shop (address: http://localhost:1234/, open it in your browser). The product must have a rating of 4.6 stars or higher and be portable. Please choose the
openclaw agent --session-id test-001 -m "$(cat /workspace/instruction.md)" --json --timeout 300
