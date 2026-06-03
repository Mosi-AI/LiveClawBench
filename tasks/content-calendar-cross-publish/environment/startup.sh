#!/usr/bin/env bash
set -euo pipefail

# wait_for_db_tables() is injected by mock-platform/scripts/build-task-images.ts
# at the top of the generated /opt/mock/startup.d/<task>.sh, alongside wait_http
# (see PR #113 review by @mockiemochi). Per-task startup_extra scripts only need
# to *call* the helper.

# A2 data injection: seed stale social posts and orphan calendar events
# Social mock writes to $MOCK_DATA_DIR/social/social.db at runtime
SOCIAL_DB="/var/lib/mock-data/social/social.db"
wait_for_db_tables "$SOCIAL_DB" 60 post

sqlite3 "$SOCIAL_DB" "INSERT OR IGNORE INTO post (id, author_account_id, content, status, visibility, scheduled_for, is_pinned) VALUES (100, 1, 'Spring Collection Preview - Coming Soon! #SpringFashion', 'scheduled', 'public', '2026-03-15 09:00:00', 0);"
sqlite3 "$SOCIAL_DB" "INSERT OR IGNORE INTO post (id, author_account_id, content, status, visibility, scheduled_for, is_pinned) VALUES (101, 1, 'Flash Sale: 20% off this weekend only! #FlashSale', 'scheduled', 'public', '2026-04-01 10:00:00', 0);"
sqlite3 "$SOCIAL_DB" "INSERT OR IGNORE INTO post (id, author_account_id, content, status, visibility, scheduled_for, is_pinned) VALUES (102, 1, 'Behind the scenes of our new product line #BTS', 'scheduled', 'public', '2026-04-20 14:00:00', 0);"

# Verify injection
STALE_COUNT=$(sqlite3 "$SOCIAL_DB" "SELECT COUNT(*) FROM post WHERE id IN (100, 101, 102);")
if [ "$STALE_COUNT" -ne 3 ]; then
    echo "ERROR: Expected 3 stale social posts after seeding, found ${STALE_COUNT}" >&2
    exit 1
fi
echo "Injected ${STALE_COUNT} stale social posts"

# Inject orphan calendar events from a failed previous sync
CALENDAR_DB="/var/lib/mock-data/calendar/calendar.db"
wait_for_db_tables "$CALENDAR_DB" 60 calendar_event
# Fixed IDs (200, 201) make INSERT OR IGNORE idempotent across container
# restarts. The calendar_event table only enforces PK uniqueness, so without
# explicit ids each re-run would append duplicate orphans and skew the
# verifier's "remaining orphan" count.
sqlite3 "$CALENDAR_DB" "INSERT OR IGNORE INTO calendar_event (id, user_id, title, start_time, end_time, description, event_type) VALUES (200, 1, 'Spring Collection Post', '2026-03-15T09:00:00', '2026-03-15T09:30:00', 'Social media post for spring collection', 'content');"
sqlite3 "$CALENDAR_DB" "INSERT OR IGNORE INTO calendar_event (id, user_id, title, start_time, end_time, description, event_type) VALUES (201, 1, 'Flash Sale Post', '2026-04-01T10:00:00', '2026-04-01T10:30:00', 'Social media post for flash sale', 'content');"

ORPHAN_COUNT=$(sqlite3 "$CALENDAR_DB" "SELECT COUNT(*) FROM calendar_event WHERE id IN (200, 201);")
if [ "$ORPHAN_COUNT" -ne 2 ]; then
    echo "ERROR: Expected 2 orphan calendar events after seeding, found ${ORPHAN_COUNT}" >&2
    exit 1
fi
echo "Injected ${ORPHAN_COUNT} orphan calendar events"
