#!/usr/bin/env bash
set -euo pipefail

# wait_for_db_tables() is injected by mock-platform/scripts/build-task-images.ts
# at the top of the generated /opt/mock/startup.d/<task>.sh, alongside wait_http
# (see PR #113 review by @mockiemochi). Per-task startup_extra scripts only need
# to *call* the helper.

# A2 data injection: seed outdated active medications in health DB
# Fixed IDs (100, 101 for medications; 200, 201 for calendar events) keep
# re-runs of this script idempotent because INSERT OR IGNORE on the PRIMARY
# KEY collision short-circuits the second insert. Without fixed IDs the
# calendar table (no UNIQUE constraint on title+start_time) would duplicate
# on every restart, leaving the verifier with a non-deterministic fixture.
HEALTH_DB="/var/lib/mock-data/health/health.db"
wait_for_db_tables "$HEALTH_DB" 60 medication

sqlite3 "$HEALTH_DB" "INSERT OR IGNORE INTO medication (id, user_id, name, display_name, frequency, dose_amount, dose_unit, start_date, end_date, notes, archived, created_at, updated_at) VALUES (100, 1, 'Glipizide', 'Glipizide 5mg', 'daily', 5.0, 'mg', '2026-01-01', '2026-04-30', 'Blood sugar control', 0, datetime('now'), datetime('now'));"
sqlite3 "$HEALTH_DB" "INSERT OR IGNORE INTO medication (id, user_id, name, display_name, frequency, dose_amount, dose_unit, start_date, end_date, notes, archived, created_at, updated_at) VALUES (101, 1, 'Acarbose', 'Acarbose 50mg', 'daily', 50.0, 'mg', '2026-02-01', '2026-04-15', 'Diabetes management', 0, datetime('now'), datetime('now'));"

MED_COUNT=$(sqlite3 "$HEALTH_DB" "SELECT COUNT(*) FROM medication WHERE id IN (100, 101) AND archived = 0;")
if [ "$MED_COUNT" -ne 2 ]; then
    echo "ERROR: Expected 2 active (archived=0) medications after seeding, found ${MED_COUNT}" >&2
    exit 1
fi
echo "Injected ${MED_COUNT} active outdated medications into health DB"

# Inject stale calendar reminders for the old medications
CALENDAR_DB="/var/lib/mock-data/calendar/calendar.db"
wait_for_db_tables "$CALENDAR_DB" 60 calendar_event

sqlite3 "$CALENDAR_DB" "INSERT OR IGNORE INTO calendar_event (id, user_id, title, start_time, end_time, description, event_type) VALUES (200, 1, 'Take Glipizide', '2026-05-22T08:00:00', '2026-05-22T08:15:00', 'Morning medication reminder', 'medication');"
sqlite3 "$CALENDAR_DB" "INSERT OR IGNORE INTO calendar_event (id, user_id, title, start_time, end_time, description, event_type) VALUES (201, 1, 'Take Acarbose', '2026-05-22T18:00:00', '2026-05-22T18:15:00', 'Evening medication reminder', 'medication');"

REMINDER_COUNT=$(sqlite3 "$CALENDAR_DB" "SELECT COUNT(*) FROM calendar_event WHERE id IN (200, 201);")
if [ "$REMINDER_COUNT" -ne 2 ]; then
    echo "ERROR: Expected 2 stale calendar reminders after seeding, found ${REMINDER_COUNT}" >&2
    exit 1
fi
echo "Injected ${REMINDER_COUNT} stale calendar reminders"
