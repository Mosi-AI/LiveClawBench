#!/usr/bin/env bash
set -euo pipefail
cd /workspace

openclaw agent --session-id test-001 -m "$(cat /workspace/instruction.md)" --json --timeout 300
