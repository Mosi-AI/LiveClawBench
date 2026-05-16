#!/usr/bin/env bash
set -euo pipefail

# Delegate to Bun mock startup (per-task base image provides /opt/mock/startup.d/${TASK_NAME}.sh)
sh /opt/mock/startup.d/${TASK_NAME}.sh

# A2 data injection: seed stale social posts (scheduled in the past) and orphan calendar events
# Social DB is at the relative path resolved by getDb()
SOCIAL_DB=$(find / -name "social.db" -path "*/mock*" 2>/dev/null | head -1 || echo "")
if [ -n "$SOCIAL_DB" ]; then
    # Insert stale scheduled posts (past dates, should have been published)
    sqlite3 "$SOCIAL_DB" "INSERT OR IGNORE INTO post (id, author_account_id, content, status, visibility, scheduled_for, is_pinned) VALUES (100, 1, 'Spring Collection Preview - Coming Soon! #SpringFashion', 'scheduled', 'public', '2026-03-15 09:00:00', 0);"
    sqlite3 "$SOCIAL_DB" "INSERT OR IGNORE INTO post (id, author_account_id, content, status, visibility, scheduled_for, is_pinned) VALUES (101, 1, 'Flash Sale: 20% off this weekend only! #FlashSale', 'scheduled', 'public', '2026-04-01 10:00:00', 0);"
    sqlite3 "$SOCIAL_DB" "INSERT OR IGNORE INTO post (id, author_account_id, content, status, visibility, scheduled_for, is_pinned) VALUES (102, 1, 'Behind the scenes of our new product line #BTS', 'scheduled', 'public', '2026-04-20 14:00:00', 0);"
    echo "Injected stale social posts"
fi

# Inject orphan calendar events from a failed previous sync
CALENDAR_DB="/var/lib/mock-data/calendar/calendar.db"
sqlite3 "$CALENDAR_DB" "INSERT OR IGNORE INTO calendar_event (user_id, title, start_time, end_time, description, event_type) VALUES (1, 'Spring Collection Post', '2026-03-15T09:00:00', '2026-03-15T09:30:00', 'Social media post for spring collection', 'content');"
sqlite3 "$CALENDAR_DB" "INSERT OR IGNORE INTO calendar_event (user_id, title, start_time, end_time, description, event_type) VALUES (1, 'Flash Sale Post', '2026-04-01T10:00:00', '2026-04-01T10:30:00', 'Social media post for flash sale', 'content');"
echo "Injected orphan calendar events"
