#!/usr/bin/env bash
set -euo pipefail

# Seed tomorrow's TerraScale Logistics Partnership Meeting into the calendar DB
CALENDAR_DB="/var/lib/mock-data/calendar/calendar.db"
if [ ! -f "$CALENDAR_DB" ]; then
    echo "ERROR: Calendar DB not found at $CALENDAR_DB" >&2
    exit 1
fi

TOMORROW=$(date -d "+1 day" +"%Y-%m-%d")

sqlite3 "$CALENDAR_DB" "
INSERT INTO calendar_event (user_id, title, start_time, end_time, description, event_type)
SELECT 1,
  'TerraScale Logistics Partnership Meeting',
  '${TOMORROW}T10:00:00',
  '${TOMORROW}T11:30:00',
  'Quarterly partnership review with TerraScale Logistics',
  'appointment'
WHERE NOT EXISTS (
  SELECT 1 FROM calendar_event
  WHERE user_id = 1 AND title = 'TerraScale Logistics Partnership Meeting'
);
"

COUNT=$(sqlite3 "$CALENDAR_DB" "SELECT COUNT(*) FROM calendar_event WHERE user_id = 1 AND title = 'TerraScale Logistics Partnership Meeting';")
if [ "$COUNT" -ne 1 ]; then
    echo "ERROR: Expected 1 TerraScale meeting event, found ${COUNT}" >&2
    exit 1
fi
echo "Seeded TerraScale Logistics Partnership Meeting for ${TOMORROW}"
