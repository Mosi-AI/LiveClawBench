#!/usr/bin/env bash
# Runnability check: run all 30 tasks with kimi-k2.5 (moonshot provider)
# Usage: bash scripts/run_runnability_check.sh
set -euo pipefail
cd "$(dirname "$0")/.."

source .env
BASE_URL="$OPENAI_BASE_URL"
API_KEY="$OPENAI_API_KEY"
JUDGE_TASKS="noise-filtering mixed-tool-memory incremental-update-ctp live-web-research-sqlite-fts5 conflict-repair-acb"
MAX_CONCURRENT=4

mkdir -p run_logs
pids=()
task_names=()

wait_for_slot() {
    while [ "${#pids[@]}" -ge "$MAX_CONCURRENT" ]; do
        new_pids=()
        new_names=()
        for i in "${!pids[@]}"; do
            if kill -0 "${pids[$i]}" 2>/dev/null; then
                new_pids+=("${pids[$i]}")
                new_names+=("${task_names[$i]}")
            fi
        done
        pids=("${new_pids[@]+"${new_pids[@]}"}")
        task_names=("${new_names[@]+"${new_names[@]}"}")
        [ "${#pids[@]}" -ge "$MAX_CONCURRENT" ] && sleep 5
    done
}

for task_dir in tasks/*/; do
    task=$(basename "$task_dir")

    judge_flags=()
    if echo "$JUDGE_TASKS" | grep -qw "$task"; then
        judge_flags=(
            --ee "JUDGE_BASE_URL=$BASE_URL"
            --ee "JUDGE_API_KEY=$API_KEY"
            --ee "JUDGE_MODEL_ID=deepseek-v3.2"
        )
    fi

    wait_for_slot

    echo "[$(date '+%H:%M:%S')] START: $task"
    (
        .venv/bin/harbor run -p "tasks/$task" -a openclaw \
            -m moonshot/kimi-k2.5 \
            -n 1 -o "jobs/${task}" \
            --ae "CUSTOM_BASE_URL=$BASE_URL" \
            --ae "CUSTOM_API_KEY=$API_KEY" \
            --ae "CUSTOM_REASONING=true" \
            "${judge_flags[@]+"${judge_flags[@]}"}" \
            >"run_logs/${task}.log" 2>&1
        code=$?
        echo "[$(date '+%H:%M:%S')] DONE: $task (exit=$code)"
    ) &
    pids+=($!)
    task_names+=("$task")
done

# Wait for remaining tasks
wait
echo "=== All tasks finished ==="

# Print summary
echo ""
echo "=== Results Summary ==="
printf "%-45s %s\n" "Task" "Score"
printf "%-45s %s\n" "----" "-----"
for task_dir in tasks/*/; do
    task=$(basename "$task_dir")
    reward=$(find "jobs/${task}" -name "reward.txt" 2>/dev/null | sort | tail -1 | xargs cat 2>/dev/null || echo "ERROR")
    printf "%-45s %s\n" "$task" "$reward"
done
