#!/usr/bin/env bash
set -euo pipefail

instruction = $(cat /workspace/instruction.md)

openclaw agent --session-id "solve-baggage-tracking-application" \
    --timeout 1800 \
    --message "$instruction"
