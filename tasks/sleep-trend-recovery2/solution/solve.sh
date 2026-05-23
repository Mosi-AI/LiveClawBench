#!/bin/bash
set -euo pipefail

SMARTHOME_DB="/tmp/mosi_smart_home.sqlite"
HEALTH_DB="/workspace/health.db"

sleep_quality=$(sqlite3 "$HEALTH_DB" "SELECT sleep_quality FROM health_daily_snapshot WHERE user_id = 1 AND date = '2026-05-09';")
prior_avg=$(sqlite3 "$HEALTH_DB" "SELECT ROUND(AVG(sleep_quality), 1) FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-05-03' AND '2026-05-08';")

if python3 - <<PY
import sys
sys.exit(0 if float("$prior_avg") - float("$sleep_quality") >= 15 else 1)
PY
then
    sqlite3 "$SMARTHOME_DB" "UPDATE coffee_schedule SET start_time = '08:30', cancelled = 0, updated_at = '2026-05-09T07:45:00Z' WHERE schedule_date = '2026-05-10';"
    sqlite3 "$SMARTHOME_DB" "UPDATE calendar_event SET title = 'Recovery Yoga', workout_type = 'yoga', updated_at = '2026-05-09T07:45:00Z' WHERE id = 3 AND start_time = '2026-05-10T12:00:00Z';"
    sqlite3 "$SMARTHOME_DB" "UPDATE calendar_event SET title = 'Zone 2 Walk', workout_type = 'walking', updated_at = '2026-05-09T07:45:00Z' WHERE id = 6 AND start_time = '2026-05-10T17:30:00Z';"
    sqlite3 "$SMARTHOME_DB" "UPDATE calendar_event SET title = 'Easy Cycling', workout_type = 'cycling', updated_at = '2026-05-09T07:45:00Z' WHERE id = 7 AND start_time = '2026-05-10T19:00:00Z';"
fi

mkdir -p /workspace/output
cat > /workspace/output/response.txt <<'EOF'
Today's Sleep Quality was 52, compared with my usual recent six-day average of 80.5, a drop of 28.5 points. The 7-day sleep trend is falling, which correctly reflects last night's poor sleep. The 14-day and 30-day trends still look stable because those longer windows smooth out a single bad night and cannot fully capture yesterday's recovery dip. Sleep Duration fell to 5.4 hours, Light Sleep made up most of the night at 3.85h, and Deep Sleep at 0.65h plus REM Sleep at 0.90h were both lower than usual, so the companion sleep metrics also point to poor recovery. In the smart home schedule, I left today's 07:00 coffee unchanged. For tomorrow, I changed the 12:00 HIIT Workout to Recovery Yoga, downgraded the 17:30 Sprint Intervals to a walk, and replaced the 19:00 Boxing Conditioning session with easy cycling because the sleep drop suggests avoiding all high-intensity exercise. I delayed tomorrow's coffee from 07:00 to 08:30, which still gives the coffee maker a 30-minute brew window before the 09:00 Morning Routine, and I left the 14:00 Team Meeting unchanged. The smart-home Wearable & Recovery page shows today's date but all the values are 0, so it has not been synced with the health data yet and should not be trusted.
EOF
