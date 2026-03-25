#!/usr/bin/env bash
set -euo pipefail

cd /workspace

# Single-round dialogue execution
openclaw agent -m "Analyze the interaction history in /workspace/environment/history.json to discover any repeating patterns that could be automated. Then update the interaction_pattern_analyzer skill to reflect the patterns you found, and save the updated skill files (including the revised SKILL.md) to /workspace/output."
