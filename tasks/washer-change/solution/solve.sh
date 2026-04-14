#!/usr/bin/env bash
set -euo pipefail
cd /workspace

# Agent task:
# I recently purchased a Kenmore top load washer at Mosi Shop (address: http://localhost:1234/), but now I realize it's not portable enough. Please help me refund it at my orders of Mosi Shop (address: 
openclaw agent --session-id test-001 -m "$(cat /workspace/instruction.md)" --json --timeout 300
