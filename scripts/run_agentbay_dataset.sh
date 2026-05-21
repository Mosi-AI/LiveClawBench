#!/usr/bin/env bash
# Run LiveClawBench using Harbor's AgentBay environment backend.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

HARBOR_BIN="${HARBOR_BIN:-.venv/bin/harbor}"
IMAGE_LOCK_PATH="${IMAGE_LOCK_PATH:-agentbay/image_lock.toml}"
MODEL="${MODEL:-moonshot/kimi-k2.5}"
DATASET_VERSION="${DATASET_VERSION:-0.1.0}"
N_CONCURRENT="${N_CONCURRENT:-30}"
N_ATTEMPTS="${N_ATTEMPTS:-3}"
TIMEOUT_MULTIPLIER="${TIMEOUT_MULTIPLIER:-2.0}"
JOBS_DIR="${JOBS_DIR:-jobs}"
CUSTOM_REASONING="${CUSTOM_REASONING:-true}"
ENV_PASSTHROUGH="${ENV_PASSTHROUGH:-JUDGE_BASE_URL,JUDGE_API_KEY,JUDGE_MODEL_ID}"

OPENAI_BASE_URL="${OPENAI_BASE_URL:-${CUSTOM_BASE_URL:-}}"
OPENAI_API_KEY="${OPENAI_API_KEY:-${CUSTOM_API_KEY:-}}"
JUDGE_BASE_URL="${JUDGE_BASE_URL:-$OPENAI_BASE_URL}"
JUDGE_API_KEY="${JUDGE_API_KEY:-$OPENAI_API_KEY}"
JUDGE_MODEL_ID="${JUDGE_MODEL_ID:-deepseek-v3.2}"

if [ ! -x "$HARBOR_BIN" ]; then
    echo "ERROR: Harbor binary not found at $HARBOR_BIN. Run ./setup.sh first." >&2
    exit 1
fi

if [ ! -f "$IMAGE_LOCK_PATH" ]; then
    echo "ERROR: AgentBay image lock not found: $IMAGE_LOCK_PATH" >&2
    echo "Copy agentbay/image_lock.example.toml to agentbay/image_lock.toml and fill active imgc IDs." >&2
    exit 1
fi

if [ -z "${AGENTBAY_API_KEY:-}" ]; then
    echo "ERROR: AGENTBAY_API_KEY is required for --env agentbay." >&2
    exit 1
fi

if [ -z "$OPENAI_BASE_URL" ] || [ -z "$OPENAI_API_KEY" ]; then
    echo "ERROR: OPENAI_BASE_URL and OPENAI_API_KEY are required for the OpenClaw custom endpoint." >&2
    exit 1
fi

export AGENTBAY_API_KEY
export JUDGE_BASE_URL
export JUDGE_API_KEY
export JUDGE_MODEL_ID

"$HARBOR_BIN" run --dataset "liveclawbench@$DATASET_VERSION" \
  --registry-path ./registry.json \
  -a openclaw \
  -m "$MODEL" \
  --n-concurrent "$N_CONCURRENT" \
  --n-attempts "$N_ATTEMPTS" \
  -o "$JOBS_DIR" \
  --ae "CUSTOM_BASE_URL=$OPENAI_BASE_URL" \
  --ae "CUSTOM_API_KEY=$OPENAI_API_KEY" \
  --ae "CUSTOM_REASONING=$CUSTOM_REASONING" \
  --timeout-multiplier "$TIMEOUT_MULTIPLIER" \
  --env agentbay \
  --environment-kwarg "image_lock_path=$IMAGE_LOCK_PATH" \
  --environment-kwarg benchmark_name=liveclawbench \
  --environment-kwarg prebuild=true \
  --environment-kwarg "env_passthrough=$ENV_PASSTHROUGH"
