#!/usr/bin/env bash
set -euo pipefail

# Delegate to Bun mock startup (per-task base image provides /opt/mock/startup.d/${TASK_NAME}.sh)
sh /opt/mock/startup.d/${TASK_NAME}.sh

# A2 data injection: seed outdated active medications in health DB
# These are medications that conflict with the new prescription from Dr. Harris
HEALTH_DB="/workspace/health.db"
sqlite3 "$HEALTH_DB" "INSERT OR IGNORE INTO medication (id, user_id, name, display_name, frequency, dose_amount, dose_unit, start_date, end_date, notes, archived) VALUES (100, 1, 'Glipizide', 'Glipizide 5mg', 'daily', 5.0, 'mg', '2026-01-01', '2026-04-30', 'Blood sugar control', 0);"
sqlite3 "$HEALTH_DB" "INSERT OR IGNORE INTO medication (id, user_id, name, display_name, frequency, dose_amount, dose_unit, start_date, end_date, notes, archived) VALUES (101, 1, 'Acarbose', 'Acarbose 50mg', 'daily', 50.0, 'mg', '2026-02-01', '2026-04-15', 'Diabetes management', 0);"
echo "Injected outdated medications into health DB"

# Also inject stale calendar reminders for the old medications
CALENDAR_DB="/var/lib/mock-data/calendar/calendar.db"
sqlite3 "$CALENDAR_DB" "INSERT OR IGNORE INTO calendar_event (user_id, title, start_time, end_time, description, event_type) VALUES (1, 'Take Glipizide', '2026-05-22T08:00:00', '2026-05-22T08:15:00', 'Morning medication reminder', 'medication');"
sqlite3 "$CALENDAR_DB" "INSERT OR IGNORE INTO calendar_event (user_id, title, start_time, end_time, description, event_type) VALUES (1, 'Take Acarbose', '2026-05-22T18:00:00', '2026-05-22T18:15:00', 'Evening medication reminder', 'medication');"
echo "Injected stale calendar reminders"
