#!/usr/bin/env bash
# Run all 6 skill-* cases in parallel via nohup.
# Usage: bash run_skill_bench.sh
set -euo pipefail

CUSTOM_BASE_URL="https://ark.cn-beijing.volces.com/api/coding/v3"
CUSTOM_API_KEY="50106bfe-c1be-49a2-ba5a-40cda9f9e38b"
MODEL="custom/kimi-k2.5"
OUTDIR="jobs"

CASES=(
  skill-conflict-resolution
  skill-repository-curation
)

mkdir -p logs

for case in "${CASES[@]}"; do
  echo "[$(date '+%H:%M:%S')] Launching $case ..."
  nohup .venv/bin/harbor run \
    -p "tasks/${case}" \
    -a openclaw \
    -m "$MODEL" \
    -n 1 \
    -o "$OUTDIR" \
    --ae CUSTOM_BASE_URL="$CUSTOM_BASE_URL" \
    --ae CUSTOM_API_KEY="$CUSTOM_API_KEY" \
    > "logs/${case}.log" 2>&1 &
  echo "  PID=$! → logs/${case}.log"
done

echo ""
echo "All 6 cases launched. Monitor with:"
echo "  tail -f logs/skill-*.log"
echo "  # or check results:"
echo "  cat jobs/*/skill-*/verifier/reward.txt"
