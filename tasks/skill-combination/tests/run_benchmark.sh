#!/usr/bin/env bash
# ============================================================================
# sh_skill_combination — Cross-Skill Composition Recognition Benchmark
#
# This script:
#   1. Deploys environment files to the benchmark directory
#   2. Runs up to 5 rounds of dialogue (early-exit if model proposes composition)
#   3. Falls back to an explicit /skill prompt if model doesn't propose on its own
#   4. Runs tests/evaluate.py to score the result
#
# Usage (from case root):
#   bash tests/run_benchmark.sh
#
# Flags:
#   --skip-agent   Skip openclaw invocation (re-scoring mode)
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── WSL target paths ─────────────────────────────────────────────
CASE_DIR="$HOME/.openclaw/benchmark/sh/sh_skill_combination"
WORKSPACE="$HOME/.openclaw/workspace"
SKILLS_DIR="$WORKSPACE/skills"
MODEL_RESPONSE_DIR="$CASE_DIR/model_response"
OUTPUT_DIR="$CASE_DIR/environment/output"

SKIP_AGENT=false
for arg in "$@"; do
    case "$arg" in
        --skip-agent) SKIP_AGENT=true ;;
    esac
done

# ── Deploy environment files to WSL ──────────────────────────────
echo "Deploying environment files to $CASE_DIR ..."
mkdir -p "$CASE_DIR" "$MODEL_RESPONSE_DIR" "$SKILLS_DIR" "$OUTPUT_DIR"

# Copy environment (skills + data + SOUL.md)
cp -r "$BASE_DIR/environment/skills/"*  "$SKILLS_DIR/" 2>/dev/null || true
cp -r "$BASE_DIR/environment/data"      "$CASE_DIR/environment/" 2>/dev/null || true
cp    "$BASE_DIR/environment/SOUL.md"   "$WORKSPACE/" 2>/dev/null || true

# ── Generate Session ID ─────────────────────────────────────────
SESSION_ID="bench-skill-comb-$(uuidgen 2>/dev/null || python3 -c 'import uuid; print(uuid.uuid4())')"
export session_id="$SESSION_ID"

cd "$CASE_DIR"
echo "=========================================================="
echo "  sh_skill_combination — Cross-Skill Composition Benchmark"
echo "  Session ID: $SESSION_ID"
echo "  Time: $(date -Iseconds)"
echo "  WKDIR: $CASE_DIR"
echo "=========================================================="
echo ""

# ── Prompts ─────────────────────────────────────────────────────
PROMPT_SKILL="/skill skill-creator create a composite skill that combines the log-parser and csv-stats-reporter skills into a single pipeline. Save it to ${CASE_DIR}/model_response/"

PROMPTS=(
  "I have API server logs from Monday. Please filter ${CASE_DIR}/environment/data/api_server_monday.jsonl to extract only ERROR and WARN events between 09:00 and 17:00, save the filtered CSV to ${CASE_DIR}/environment/output/monday_filtered.csv, then compute response time statistics (mean, median, p95, p99) on the filtered data grouped by service, and save the stats report to ${CASE_DIR}/environment/output/monday_stats.json. You can use the existing skills in ${CASE_DIR}/environment/skills/ to help."
  "Same thing for Tuesday's logs. Filter ${CASE_DIR}/environment/data/api_server_tuesday.jsonl for ERROR and WARN from 09:00-17:00, save filtered CSV to ${CASE_DIR}/environment/output/tuesday_filtered.csv, then generate the response time stats report grouped by service to ${CASE_DIR}/environment/output/tuesday_stats.json."
  "And Wednesday too: ${CASE_DIR}/environment/data/api_server_wednesday.jsonl, same filters (ERROR+WARN, 09:00-17:00). Filtered CSV → ${CASE_DIR}/environment/output/wednesday_filtered.csv, stats report → ${CASE_DIR}/environment/output/wednesday_stats.json. Group by service as before."
  "One more — Thursday: ${CASE_DIR}/environment/data/api_server_thursday.jsonl. Same workflow: filter ERROR/WARN 09:00-17:00 → ${CASE_DIR}/environment/output/thursday_filtered.csv, then stats by service → ${CASE_DIR}/environment/output/thursday_stats.json."
  "I realize I keep asking you to do the same two-step process. We have log-parser and csv-stats-reporter as separate skills already. Could you create a combined skill that chains them together so I can do this in one step next time? Save the new skill to ${CASE_DIR}/model_response/."
)

TOTAL_ROUNDS=${#PROMPTS[@]}

# ── Dialogue log ────────────────────────────────────────────────
DIALOGUE_LOG="$MODEL_RESPONSE_DIR/dialogue.json"
echo "[]" > "$DIALOGUE_LOG"

# Helper: append a round to the JSON dialogue log
append_round() {
  local round_num="$1"
  local prompt="$2"
  local response="$3"
  python3 -c "
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    log = json.load(f)
log.append({
    'round': int(sys.argv[2]),
    'prompt': sys.argv[3],
    'response': sys.argv[4]
})
with open(sys.argv[1], 'w', encoding='utf-8') as f:
    json.dump(log, f, indent=2, ensure_ascii=False)
" "$DIALOGUE_LOG" "$round_num" "$prompt" "$response"
}

# ── Trigger regex for early-exit ────────────────────────────────
TRIGGER_RE='combin|compos|chain|pipeline|merge.*skill|unified.*skill|single.*step'

# ── Run dialogue rounds ─────────────────────────────────────────
if [ "$SKIP_AGENT" = false ]; then
    EARLY_EXIT=false
    for (( i=0; i<TOTAL_ROUNDS; i++ )); do
        ROUND=$((i + 1))
        CURRENT_PROMPT="${PROMPTS[$i]}"

        echo ""
        echo "── Round $ROUND ──────────────────────────────────────────────"
        echo "Prompt: ${CURRENT_PROMPT:0:120}..."
        echo ""

        # Capture model response
        RESPONSE=$(openclaw agent --session-id "$SESSION_ID" -m "$CURRENT_PROMPT" 2>&1 | tee /dev/stderr)

        # Log the round
        append_round "$ROUND" "$CURRENT_PROMPT" "$RESPONSE"

        # Check for early-exit trigger (only in rounds 1-4)
        if [ "$ROUND" -lt 5 ] && echo "$RESPONSE" | grep -qiP "$TRIGGER_RE"; then
            echo ""
            echo "── [Auto-detected composition proposal in Round $ROUND] ──"
            echo "── Sending PROMPT_SKILL and skipping remaining rounds ──"
            echo ""

            SKILL_ROUND=$((ROUND + 1))
            echo "── Round $SKILL_ROUND (PROMPT_SKILL) ──────────────────────"
            echo "Prompt: $PROMPT_SKILL"
            echo ""

            SKILL_RESPONSE=$(openclaw agent --session-id "$SESSION_ID" -m "$PROMPT_SKILL" 2>&1 | tee /dev/stderr)
            append_round "$SKILL_ROUND" "$PROMPT_SKILL" "$SKILL_RESPONSE"

            EARLY_EXIT=true
            break
        fi
    done
else
    echo "[Skipping openclaw agent invocation (--skip-agent)]"
fi
echo ""

# ── Evaluate ─────────────────────────────────────────────────────
echo "── Evaluation ───────────────────────────────────────────"

SCORE_JSON="$MODEL_RESPONSE_DIR/score.json"

# Check if SKILL.md exists; if not, send fallback PROMPT_SKILL
if [ "$SKIP_AGENT" = false ]; then
    if ! find "$MODEL_RESPONSE_DIR" -name "SKILL.md" | grep -q .; then
        echo ""
        echo "── [SKILL.md not found — sending PROMPT_SKILL as fallback] ──"
        echo "Prompt: $PROMPT_SKILL"
        echo ""

        FALLBACK_RESPONSE=$(openclaw agent --session-id "$SESSION_ID" -m "$PROMPT_SKILL" 2>&1 | tee /dev/stderr)
        append_round 99 "$PROMPT_SKILL" "$FALLBACK_RESPONSE"
    fi
fi

# Run evaluation
python3 "$SCRIPT_DIR/evaluate.py" \
    --model-output "$MODEL_RESPONSE_DIR" \
    --dialogue "$DIALOGUE_LOG" \
    --output-json "$SCORE_JSON"

echo ""
echo "Score saved to: $SCORE_JSON"
echo "Dialogue log:   $DIALOGUE_LOG"
