#!/usr/bin/env bash
set -euo pipefail

# A2 data injection: seed stale social posts and orphan calendar events
# Social mock writes to $MOCK_DATA_DIR/social/social.db at runtime
SOCIAL_DB="/var/lib/mock-data/social/social.db"
if [ ! -f "$SOCIAL_DB" ]; then
    echo "ERROR: Social DB not found at $SOCIAL_DB; cannot seed required A2 fixtures" >&2
    echo "       The social mock must be running and have initialized its database before this script runs." >&2
    exit 1
fi

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
if [ ! -f "$CALENDAR_DB" ]; then
    echo "ERROR: Calendar DB not found at $CALENDAR_DB; cannot seed orphan A2 events" >&2
    echo "       The calendar mock must be running and have initialized its database before this script runs." >&2
    exit 1
fi
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
