#!/usr/bin/env bash
# Seed calendar with the NXL analyst call on this Thursday.
# Runs after the calendar mock binary starts (via startup_extra).
set -euo pipefail

CALENDAR_DB="/var/lib/mock-data/calendar/calendar.db"

# Wait for the calendar mock to create its database (up to 30 s)
for i in $(seq 1 30); do
  if [ -f "$CALENDAR_DB" ]; then
    break
  fi
  sleep 1
done

if [ ! -f "$CALENDAR_DB" ]; then
  echo "WARNING: calendar DB not found at $CALENDAR_DB after 30s; skipping seed"
  exit 0
fi

# Calculate the date of this coming Thursday (weekday 4 in Python, 0=Monday)
NEXT_THURSDAY=$(python3 - <<'PYEOF'
from datetime import datetime, timedelta
today = datetime.now()
days_ahead = (3 - today.weekday()) % 7
if days_ahead == 0:
    days_ahead = 7
thu = today + timedelta(days=days_ahead)
print(thu.strftime("%Y-%m-%d"))
PYEOF
)

START_TIME="${NEXT_THURSDAY}T14:00:00"
END_TIME="${NEXT_THURSDAY}T16:00:00"

# Insert the analyst call event for user_id=1 (Peter Griffin, seeded by the mock)
sqlite3 "$CALENDAR_DB" <<SQL
INSERT OR IGNORE INTO calendar_event (user_id, title, start_time, end_time, source, source_ref)
VALUES (
  1,
  'NXL Q3 Investor Call',
  '${START_TIME}',
  '${END_TIME}',
  'IR',
  'Q3 2024 earnings call — Nexaline Therapeutics investor relations'
);
SQL

echo "Calendar seeded: NXL Q3 Investor Call on ${NEXT_THURSDAY} 14:00–16:00"
