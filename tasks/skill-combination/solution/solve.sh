#!/usr/bin/env bash
set -euo pipefail

cd /workspace
SKILLS="/workspace/environment/skills"
DATA="/workspace/environment/data"
OUTPUT="/workspace/environment/output"
MODEL_RESPONSE="/workspace/model_response"

mkdir -p "$OUTPUT" "$MODEL_RESPONSE"

# Process 4 days of logs using existing skills
for day in monday tuesday wednesday thursday; do
    python3 "$SKILLS/log-parser/log_parser.py" \
        -i "$DATA/api_server_${day}.jsonl" \
        -o "$OUTPUT/${day}_filtered.csv" \
        --start 09:00 --end 17:00 --levels ERROR,WARN

    python3 "$SKILLS/csv-stats-reporter/stats_reporter.py" \
        -i "$OUTPUT/${day}_filtered.csv" \
        -o "$OUTPUT/${day}_stats.json" \
        --group-by service
done

# Create composite skill SKILL.md
cp /tests/reference/golden_answer/SKILL.md "$MODEL_RESPONSE/SKILL.md"
cp /tests/reference/golden_answer/log_health_analyzer.py "$MODEL_RESPONSE/log_health_analyzer.py"
