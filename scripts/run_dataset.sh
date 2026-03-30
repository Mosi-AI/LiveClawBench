#!/usr/bin/env bash
# Run all 30 LiveClawBench tasks using harbor --dataset with --registry-path
# This avoids timestamp collision issues by letting harbor manage job directories internally.
#
# Usage: bash scripts/run_dataset.sh
set -euo pipefail
cd "$(dirname "$0")/.."

source .env

.venv/bin/harbor run --dataset liveclawbench@1.0 \
  --registry-path ./registry.json \
  -a openclaw \
  -m custom/kimi-k2.5 \
  --n-concurrent 4 \
  --n-attempts 1 \
  -o jobs \
  --ae "CUSTOM_BASE_URL=$OPENAI_BASE_URL" \
  --ae "CUSTOM_API_KEY=$OPENAI_API_KEY" \
  --ee "JUDGE_BASE_URL=$OPENAI_BASE_URL" \
  --ee "JUDGE_API_KEY=$OPENAI_API_KEY" \
  --ee "JUDGE_MODEL_ID=deepseek-v3.2" \
  --timeout-multiplier 2.0
