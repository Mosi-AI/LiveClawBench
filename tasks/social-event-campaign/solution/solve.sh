#!/usr/bin/env bash
set -euo pipefail
cd /workspace

# Agent task:
# 1. Check email inbox for event campaign publishing instructions
# 2. Login to social media as mosi_brand
# 3. Publish the draft event campaign post (post 101)
# 4. Send confirmation email to events@mosi.inc
openclaw agent --session-id test-001 -m "$(cat /workspace/instruction.md)" --json --timeout 300
