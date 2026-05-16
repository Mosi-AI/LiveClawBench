#!/usr/bin/env bash
set -euo pipefail

# Delegate to Bun mock startup (per-task base image provides /opt/mock/startup.d/${TASK_NAME}.sh)
sh /opt/mock/startup.d/${TASK_NAME}.sh

# Inject old calendar event for meeting-reschedule-response task
# The old meeting that the agent needs to delete
CALENDAR_DB="/var/lib/mock-data/calendar/calendar.db"
sqlite3 "$CALENDAR_DB" "INSERT OR IGNORE INTO calendar_event (user_id, title, start_time, end_time, description, event_type) VALUES (1, 'Project Sync', '2026-05-22T14:00:00', '2026-05-22T15:00:00', 'Weekly project sync in Conference Room B', 'appointment');"
echo "Injected old meeting event into calendar"
