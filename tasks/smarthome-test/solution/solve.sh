#!/usr/bin/env bash
set -euo pipefail
# Reference solution: run openclaw agent with the task instruction
openclaw agent --session-id "solve-smarthome-test" \
    --timeout 300 \
    --message "$(cat /workspace/instruction.md)"
