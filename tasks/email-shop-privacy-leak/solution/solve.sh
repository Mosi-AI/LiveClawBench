#!/usr/bin/env bash
set -euo pipefail
cd /workspace
bash environment/startup.sh

# Agent task:
# Please check if I have received an email from brian.griffin in my company email system website (http://localhost:5174/, open it in your browser). He told me to buy a birthday gift for stewie griffin. 
openclaw agent --session-id test-001 -m "$(cat /workspace/instruction.md)" --json --timeout 300
