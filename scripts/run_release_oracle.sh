#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-all}"
TIMEOUT_MULTIPLIER="${TIMEOUT_MULTIPLIER:-2.0}"
MODEL_NAME="${HARBOR_ORACLE_MODEL:-volcengine-plan/kimi-k2.5}"

TASKS=(
  noise-filtering
  incremental-update-ctp
  conflict-repair-acb
  mixed-tool-memory
  live-web-research-sqlite-fts5
)

usage() {
  echo "Usage: $(basename "$0") <task-name|all>" >&2
  exit 1
}

if [[ -z "${OPENCLAW_ARK_API_KEY:-}" ]]; then
  echo "OPENCLAW_ARK_API_KEY is not set" >&2
  exit 1
fi

resolve_tasks() {
  local target="$1"
  local task
  if [[ "${target}" == "all" ]]; then
    printf '%s\n' "${TASKS[@]}"
    return
  fi
  for task in "${TASKS[@]}"; do
    if [[ "${task}" == "${target}" ]]; then
      printf '%s\n' "${task}"
      return
    fi
  done
  usage
}

cd "${ROOT}"

if ! docker image inspect liveclawbench-base:latest >/dev/null 2>&1; then
  docker build -t liveclawbench-base:latest docker/base/
fi

while IFS= read -r task; do
  args=(
    run
    -p "tasks/${task}"
    -a oracle
    -m "${MODEL_NAME}"
    -n 1
    -o jobs
    --timeout-multiplier "${TIMEOUT_MULTIPLIER}"
    --force-build
    --debug
    --artifact /home/node/.openclaw/output
    --artifact /home/node/.openclaw/workspace
    --ae "OPENCLAW_ARK_API_KEY=${OPENCLAW_ARK_API_KEY}"
    --ee "OPENCLAW_ARK_API_KEY=${OPENCLAW_ARK_API_KEY}"
  )

  for env_name in OPENCLAW_ARK_BASE_URL OPENCLAW_ARK_MODEL OPENCLAW_JUDGE_BASE_URL OPENCLAW_JUDGE_MODEL OPENCLAW_JUDGE_API_KEY; do
    if [[ -n "${!env_name:-}" ]]; then
      args+=(--ae "${env_name}=${!env_name}" --ee "${env_name}=${!env_name}")
    fi
  done

  .venv/bin/harbor "${args[@]}"
done < <(resolve_tasks "${TARGET}")

# OPENCLAW_ARK_API_KEY="50106bfe-c1be-49a2-ba5a-40cda9f9e38b" OPENCLAW_ARK_MODEL="kimi-k2.5" OPENCLAW_JUDGE_MODEL="deepseek-v3.2" bash LiveClawBench/scripts/run_release_oracle.sh mixed-tool-memory
