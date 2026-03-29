#!/usr/bin/env bash
set -euo pipefail

cd /workspace

# Single-round dialogue execution
openclaw agent -m "Are there any operations that can be automated recently, according to potential patterns within the interaction history in /workspace/environment/history.json? Please update the skills according to the pattern you discovered, and save the updated skills in /workspace/output."
