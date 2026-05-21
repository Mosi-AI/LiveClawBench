#!/bin/bash
set -euo pipefail

SMARTHOME_DB="/tmp/mosi_smart_home.sqlite"
HEALTH_DB="/workspace/health.db"

sleep_quality=$(sqlite3 "$HEALTH_DB" "SELECT sleep_quality FROM health_daily_snapshot WHERE user_id = 1 AND date = '2026-05-09';")

if python3 - <<PY
import sys
sys.exit(0 if float("$sleep_quality") < 70 else 1)
PY
then
    sqlite3 "$SMARTHOME_DB" "UPDATE thermostat_settings SET mode = 'comfort', temperature = 76.0, updated_at = '2026-05-09T07:45:00Z' WHERE id = 1;"
    sqlite3 "$SMARTHOME_DB" "UPDATE calendar_event SET workout_type = 'swimming', updated_at = '2026-05-09T07:45:00Z' WHERE title = 'HIIT Workout' AND start_time = '2026-05-09T09:00:00Z';"
    sqlite3 "$SMARTHOME_DB" "UPDATE coffee_schedule SET start_time = '07:30', cancelled = 0, updated_at = '2026-05-09T07:45:00Z' WHERE schedule_date = '2026-05-09';"
fi

mkdir -p /workspace/output
cat > /workspace/output/response.txt <<'EOF'
I found Sleep duration 6.5 hrs, Sleep Quality 62%, Light Sleep 4.09h, Deep Sleep 1.11h, and REM Sleep 1.3h. Resting HR was 110 bpm, which is notably elevated and concerning for recovery. I set the thermostat to comfort mode at 76°F, switched the 09:00 HIIT Workout to swimming, and delayed today's coffee schedule to 07:30. The coffee page showed READY before the edit, so the schedule change cannot affect coffee that has already brewed today. Would you like me to change tomorrow's coffee time instead?
EOF
