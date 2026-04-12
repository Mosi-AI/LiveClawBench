#!/usr/bin/env bash
set -euo pipefail
# Reference solution: run openclaw agent with the task instruction
openclaw agent --session-id "solve-flight-seat-selection" \
    --timeout 120 \
    --message "$(cat /workspace/instruction.md)"
