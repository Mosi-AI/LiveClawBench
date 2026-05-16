#!/usr/bin/env python3
"""Verify meeting-reschedule-response task:
1. Old meeting event (Friday May 22 2:00-3:00 PM) deleted from calendar.
2. New meeting event (Saturday May 23 10:00-11:00 AM) exists in calendar.
3. Confirmation email sent to hr.department.
"""

import sqlite3
import sys
from datetime import datetime, timezone

CALENDAR_DB_PATH = "/var/lib/mock-data/calendar/calendar.db"
EMAIL_DB_PATH = "/var/lib/mock-data/email/email.db"

# Wall-clock instants the agent must produce in the calendar (UTC).
# The mock stores ISO 8601 with ".000Z" suffix via Date.toISOString(); we compare
# as parsed datetimes to be robust to format differences (Z vs +00:00, ms suffix).
OLD_START = datetime(2026, 5, 22, 14, 0, 0, tzinfo=timezone.utc)
OLD_END = datetime(2026, 5, 22, 15, 0, 0, tzinfo=timezone.utc)
NEW_START = datetime(2026, 5, 23, 10, 0, 0, tzinfo=timezone.utc)
NEW_END = datetime(2026, 5, 23, 11, 0, 0, tzinfo=timezone.utc)


def parse_iso(value: str) -> datetime | None:
    """Parse an ISO 8601 string into a UTC datetime, or None on failure."""
    if not value:
        return None
    try:
        # Accept both "...Z" and "...+00:00" forms.
        normalized = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except (ValueError, TypeError):
        return None


def find_event(cursor, start: datetime, end: datetime):
    """Return the first user-1 event whose UTC instants match (start, end), or None."""
    cursor.execute(
        "SELECT id, title, start_time, end_time, event_type FROM calendar_event WHERE user_id = 1",
    )
    for row in cursor.fetchall():
        row_start = parse_iso(row["start_time"])
        row_end = parse_iso(row["end_time"])
        if row_start == start and row_end == end:
            return row
    return None


def check_old_event_deleted():
    """Old meeting event should no longer exist."""
    try:
        conn = sqlite3.connect(CALENDAR_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open calendar database: {e}")
        return 0.0

    row = find_event(cursor, OLD_START, OLD_END)
    conn.close()

    if row is None:
        print("PASS: Old meeting event has been deleted")
        return 0.33
    print(f"FAIL: Old meeting event still exists (id={row['id']}, title='{row['title']}')")
    return 0.0


def check_new_event_created():
    """New rescheduled meeting event should exist."""
    try:
        conn = sqlite3.connect(CALENDAR_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open calendar database: {e}")
        return 0.0

    row = find_event(cursor, NEW_START, NEW_END)
    conn.close()

    if row:
        print(f"PASS: New meeting event exists (id={row['id']}, title='{row['title']}', type='{row['event_type']}')")
        return 0.34
    print("FAIL: New meeting event not found for the rescheduled time")
    return 0.0


def check_confirmation_email():
    """Confirmation email should be sent to HR."""
    try:
        conn = sqlite3.connect(EMAIL_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open email database: {e}")
        return 0.0

    cursor.execute(
        "SELECT id, subject, body, folder FROM emails WHERE sender_id = 1 AND folder = 'sent' AND recipient_email = 'hr@work.mosi.inc' ORDER BY id DESC LIMIT 1",
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        print("FAIL: No confirmation email sent to hr@work.mosi.inc")
        return 0.0

    subject_lower = (row["subject"] or "").lower()
    body_lower = (row["body"] or "").lower()

    has_reschedule = "reschedule" in subject_lower or "reschedule" in body_lower or "confirm" in subject_lower
    has_new_time = "may 23" in body_lower or "10:00" in body_lower or "friday" in body_lower

    if has_reschedule and has_new_time:
        print(f"PASS: Confirmation email sent (subject='{row['subject']}')")
        return 0.33

    if has_reschedule or has_new_time:
        print(f"PARTIAL: Email sent but missing some details (subject='{row['subject']}')")
        return 0.15

    print(f"FAIL: Email sent but doesn't confirm reschedule (subject='{row['subject']}')")
    return 0.0


def main():
    scores = []
    scores.append(check_old_event_deleted())
    scores.append(check_new_event_created())
    scores.append(check_confirmation_email())

    total = sum(scores)
    print(f"Score: {total:.2f}/1.0")
    sys.exit(0 if total >= 0.9 else 1)


if __name__ == "__main__":
    main()
