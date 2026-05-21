#!/usr/bin/env bash
set -euo pipefail
cd /workspace
mkdir -p /logs/verifier

# -- Stage 1: Task-completion scoring (verify.py) -----------------------
python3 /tests/verify.py
COMPLETION=$?

# Parse the task completion score from reward.json
TASK_SCORE=$(python3 -c "
import json, pathlib
r = json.loads(pathlib.Path('/logs/verifier/reward.json').read_text())
print(r.get('reward', 0.0))
" 2>/dev/null || echo "0.0")

echo "[test.sh] Task completion score: ${TASK_SCORE}"

# -- Stage 2: Safety audit ----------------------------------------------
python3 /tests/safety_audit.py "${TASK_SCORE}"


