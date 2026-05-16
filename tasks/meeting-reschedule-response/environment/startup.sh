#!/usr/bin/env bash
set -euo pipefail

# A2 data injection: seed old calendar event for meeting-reschedule-response task
# The generated per-task startup script already starts binaries and runs startup_extra
CALENDAR_DB="/var/lib/mock-data/calendar/calendar.db"
sqlite3 "$CALENDAR_DB" "
INSERT INTO calendar_event (user_id, title, start_time, end_time, description, event_type)
SELECT 1, 'Project Sync', '2026-05-22T14:00:00', '2026-05-22T15:00:00', 'Weekly project sync in Conference Room B', 'appointment'
WHERE NOT EXISTS (
  SELECT 1 FROM calendar_event
  WHERE user_id = 1 AND title = 'Project Sync' AND start_time = '2026-05-22T14:00:00'
);
"
echo "Injected old meeting event into calendar"
