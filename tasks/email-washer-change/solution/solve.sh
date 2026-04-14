#!/usr/bin/env bash
set -euo pipefail
cd /workspace

# Agent task:
# Please check if I have received an email from lois.griffin in my company email system website (http://localhost:5174/, open it in your browser). She told me that I should not buy the non-portable Kenm
openclaw agent --session-id test-001 -m "$(cat /workspace/instruction.md)" --json --timeout 300
