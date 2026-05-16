#!/usr/bin/env bash
set -euo pipefail

# A2 data injection: seed old calendar event for meeting-reschedule-response task
# The generated per-task startup script already starts binaries and runs startup_extra
CALENDAR_DB="/var/lib/mock-data/calendar/calendar.db"
sqlite3 "$CALENDAR_DB" "INSERT OR IGNORE INTO calendar_event (user_id, title, start_time, end_time, description, event_type) VALUES (1, 'Project Sync', '2026-05-22T14:00:00', '2026-05-22T15:00:00', 'Weekly project sync in Conference Room B', 'appointment');"
echo "Injected old meeting event into calendar"
