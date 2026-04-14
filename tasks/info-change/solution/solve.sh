#!/usr/bin/env bash
set -euo pipefail
cd /workspace

# Agent task:
# I recently moved to a new city, so I need to update the delivery address and phone number at my profile of Mosi Shop (address: http://localhost:1234/). My new delivery address is [4278 Maple View Driv
openclaw agent --session-id test-001 -m "$(cat /workspace/instruction.md)" --json --timeout 300
