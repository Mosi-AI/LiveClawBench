#!/usr/bin/env bash
set -euo pipefail

# Seed calendar events and emails for omni-morning-decision-brief
# Uses today's actual date for event timestamps so events appear as "today"

TODAY=$(date +%Y-%m-%d)
DAY_OF_WEEK=$(date +%A)

CALENDAR_DB="/var/lib/mock-data/calendar/calendar.db"
if [ ! -f "$CALENDAR_DB" ]; then
    echo "ERROR: Calendar DB not found at $CALENDAR_DB" >&2
    exit 1
fi

# Seed four calendar events for today
# Note: Events 300-302 include a hidden schedule conflict:
#   - Q2 Budget Review: 10:00-11:00
#   - Vendor Demo (CloudEdge): 10:30-11:30  <-- overlaps with Budget Review
sqlite3 "$CALENDAR_DB" "
INSERT OR IGNORE INTO calendar_event (id, user_id, title, start_time, end_time, description, event_type)
VALUES (300, 1, 'Morning Team Standup', '${TODAY}T09:00:00', '${TODAY}T09:30:00', 'Daily product team standup. Blockers + priorities.', 'personal');
INSERT OR IGNORE INTO calendar_event (id, user_id, title, start_time, end_time, description, event_type)
VALUES (301, 1, 'Q2 Budget Review', '${TODAY}T10:00:00', '${TODAY}T11:00:00', 'Review Q2 actuals and Q3 forecast with CFO. Board presentation follows tomorrow.', 'personal');
INSERT OR IGNORE INTO calendar_event (id, user_id, title, start_time, end_time, description, event_type)
VALUES (302, 1, 'Vendor Demo - CloudEdge Integration', '${TODAY}T10:30:00', '${TODAY}T11:30:00', 'CloudEdge team demos new API integration. Prep: review webhook schema and auth migration guide.', 'personal');
INSERT OR IGNORE INTO calendar_event (id, user_id, title, start_time, end_time, description, event_type)
VALUES (303, 1, '1:1 with Jordan Chen', '${TODAY}T15:00:00', '${TODAY}T16:00:00', 'Weekly check-in with direct report. Topics: Q2 velocity, upcoming PTO.', 'personal');
"

SEEDED=$(sqlite3 "$CALENDAR_DB" "SELECT COUNT(*) FROM calendar_event WHERE id IN (300, 301, 302, 303);")
echo "Seeded ${SEEDED} calendar events for today (${TODAY})"

EMAIL_DB="/var/lib/mock-data/email/email.db"
if [ ! -f "$EMAIL_DB" ]; then
    echo "ERROR: Email DB not found at $EMAIL_DB" >&2
    exit 1
fi

PETER_ID=$(sqlite3 "$EMAIL_DB" "SELECT id FROM users WHERE username = 'peter' LIMIT 1;")
if [ -z "$PETER_ID" ]; then
    echo "ERROR: Peter user not found in email DB" >&2
    exit 1
fi

# Insert sender users (fixed IDs to avoid conflicts with default seed users 1-20)
sqlite3 "$EMAIL_DB" "
INSERT OR IGNORE INTO users (id, username, email, password_hash, created_at)
VALUES (200, 'cloudedge.partnerships', 'partnerships@cloudedge.io', 'x', datetime('now'));
INSERT OR IGNORE INTO users (id, username, email, password_hash, created_at)
VALUES (201, 'cfo.office', 'cfo@work.mosi.inc', 'x', datetime('now'));
INSERT OR IGNORE INTO users (id, username, email, password_hash, created_at)
VALUES (202, 'hr.newsletter', 'newsletter@work.mosi.inc', 'x', datetime('now'));
INSERT OR IGNORE INTO users (id, username, email, password_hash, created_at)
VALUES (203, 'cafeteria.team', 'cafeteria@work.mosi.inc', 'x', datetime('now'));
"

# Seed 4 inbox emails: 2 trivial, 2 important/actionable
sqlite3 "$EMAIL_DB" "
INSERT OR IGNORE INTO emails (id, sender_id, recipient_id, recipient_email, subject, body, folder, is_read, created_at, updated_at)
VALUES (500, 202, ${PETER_ID}, 'peter.griffin@email.app',
  'May Company Newsletter',
  'Hi team, highlights this month: new office plants installed in Lobby B, parking lottery next week, updated holiday schedule now on the intranet.',
  'inbox', 0, '${TODAY}T07:00:00', '${TODAY}T07:00:00');
INSERT OR IGNORE INTO emails (id, sender_id, recipient_id, recipient_email, subject, body, folder, is_read, created_at, updated_at)
VALUES (501, 203, ${PETER_ID}, 'peter.griffin@email.app',
  'Today''s Lunch Menu',
  'Friday Special: Grilled salmon with asparagus, Caesar salad bar, fruit cup. Cafeteria hours 11:30-13:30.',
  'inbox', 0, '${TODAY}T07:30:00', '${TODAY}T07:30:00');
INSERT OR IGNORE INTO emails (id, sender_id, recipient_id, recipient_email, subject, body, folder, is_read, created_at, updated_at)
VALUES (502, 200, ${PETER_ID}, 'peter.griffin@email.app',
  'Pre-read: CloudEdge Demo Agenda & v2 API Changes',
  'Hi Peter, ahead of today''s 10:30 demo please review: (1) new webhook schema — breaking change in event payload structure, (2) rate limit changes in v2 API — new burst/sustained limits, (3) auth migration guide — v1 tokens deprecated next quarter. Happy to answer any questions before the session. See you at 10:30!',
  'inbox', 0, '${TODAY}T08:00:00', '${TODAY}T08:00:00');
INSERT OR IGNORE INTO emails (id, sender_id, recipient_id, recipient_email, subject, body, folder, is_read, created_at, updated_at)
VALUES (503, 201, ${PETER_ID}, 'peter.griffin@email.app',
  'ACTION REQUIRED: Q2 Product Roadmap Due Today by 5 PM',
  'Peter, the Q2 product roadmap must be submitted to the board portal by 5 PM today for tomorrow''s board meeting. Please also prepare a 3-slide exec summary of top strategic priorities. This is a hard deadline — the board materials printer runs at 5:30 PM. CFO office.',
  'inbox', 0, '${TODAY}T08:15:00', '${TODAY}T08:15:00');
"

EMAIL_SEEDED=$(sqlite3 "$EMAIL_DB" "SELECT COUNT(*) FROM emails WHERE id IN (500, 501, 502, 503);")
echo "Seeded ${EMAIL_SEEDED} inbox emails for today"
