#!/usr/bin/env bash
set -euo pipefail
cd /workspace
mkdir -p /logs/verifier

# PR-7 B7.1: evaluate.py's REDUNDANCY_IDENTIFIED (15 pts) and
# CONSOLIDATION_RATIONALE (10 pts) dimensions are gated on a
# `--conversation-log` argument. Previously test.sh omitted it entirely,
# hard-zeroing 25/100 across every agent. Build a synthetic log by
# concatenating whatever evidence sources we can find at verify time:
#   - openclaw harbor session jsonl (the agent's own messages)
#   - CONSOLIDATION_RATIONALE.md written by the agent as a deliverable
# Either source is sufficient on its own; both is best.
CONV_LOG=/tmp/skill_consolidation_evidence.log
: > "$CONV_LOG"

# For each candidate, extract just the natural-language content. For
# JSONL session logs we use python to project the "content" field so the
# evaluate.py regex isn't matching on JSON framing (keys, escape
# sequences, role identifiers). For .md files we cat them verbatim.
for candidate in \
    /home/node/.openclaw/agents/main/sessions/harbor.jsonl \
    /root/.openclaw/agents/main/sessions/harbor.jsonl \
    /workspace/.openclaw/agents/main/sessions/harbor.jsonl \
    /workspace/environment/skills/sales-data-pipeline/CONSOLIDATION_RATIONALE.md \
    /workspace/environment/skills/sales-data-pipeline/RATIONALE.md \
    /workspace/output/CONSOLIDATION_RATIONALE.md; do
  if [ -s "$candidate" ]; then
    echo "# === source: $candidate ===" >> "$CONV_LOG"
    case "$candidate" in
      *.jsonl)
        python3 - "$candidate" <<'PY' >> "$CONV_LOG" || cat "$candidate" >> "$CONV_LOG"
import json, sys
for line in open(sys.argv[1], encoding="utf-8", errors="replace"):
    try:
        obj = json.loads(line)
    except json.JSONDecodeError:
        continue
    c = obj.get("content")
    if isinstance(c, str):
        print(c)
    elif isinstance(c, list):
        for part in c:
            if isinstance(part, dict) and isinstance(part.get("text"), str):
                print(part["text"])
PY
        ;;
      *)
        cat "$candidate" >> "$CONV_LOG"
        ;;
    esac
    echo "" >> "$CONV_LOG"
  fi
done

# Run evaluation (|| true: evaluate.py exits non-zero when score is 0;
# must not abort before writing reward.txt)
python3 /tests/evaluate.py \
    --base-dir /workspace \
    --model-output environment/skills/sales-data-pipeline \
    --conversation-log "$CONV_LOG" \
    --output-json /workspace/output/eval_result.json 2>&1 | tee /tmp/eval_output.txt || true

# reward.txt: 0-1 scalar (TOTAL SCORE: X / 100 → X/100)
SCORE=$(grep -oP 'TOTAL SCORE:\s*\K[0-9]+' /tmp/eval_output.txt | head -1 || echo "0")
python3 -c "print(${SCORE}/100.0)" > /logs/verifier/reward.txt

# reward.json: detailed per-criterion breakdown
cp /workspace/output/eval_result.json /logs/verifier/reward.json 2>/dev/null || \
    echo '{"error":"eval_result.json not generated"}' > /logs/verifier/reward.json
