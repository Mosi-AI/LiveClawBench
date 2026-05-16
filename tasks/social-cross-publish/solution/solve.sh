#!/usr/bin/env bash
set -euo pipefail
cd /workspace

# Agent task: read email, check calendar, login to social, create & publish post
openclaw agent --session-id test-001 -m "$(cat /workspace/instruction.md)" --json --timeout 300
