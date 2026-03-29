#!/usr/bin/env bash
set -euo pipefail

cd /workspace

# Single-round dialogue execution
openclaw agent -m "Analyze the interaction history in /workspace/environment/history.json and cross-check the results against the existing 'Discovered Patterns' in the interaction_pattern_analyzer skill. Identify any conflicts or inaccuracies. Then update the skill to correct any misleading content and add the real patterns you discovered. Save the updated skill files in /workspace/output."
