#!/usr/bin/env python3
"""Verify meeting-reschedule-response task:
1. Old meeting event (Friday May 22 2:00-3:00 PM) deleted from calendar.
2. New meeting event (Saturday May 23 10:00-11:00 AM) exists in calendar.
3. Confirmation email sent to hr.department.
"""

import sqlite3
import sys
from datetime import datetime

CALENDAR_DB_PATH = "/var/lib/mock-data/calendar/calendar.db"
EMAIL_DB_PATH = "/var/lib/mock-data/email/email.db"

# Wall-clock instants the agent must produce in the calendar (UTC).
OLD_START = datetime(2026, 5, 22, 14, 0, 0)
OLD_END = datetime(2026, 5, 22, 15, 0, 0)
NEW_START = datetime(2026, 5, 23, 10, 0, 0)
NEW_END = datetime(2026, 5, 23, 11, 0, 0)


def parse_iso(value: str) -> datetime | None:
    """Parse an ISO 8601 string into a naive UTC datetime, or None on failure."""
    if not value:
        return None
    try:
        s = value.strip()
        if s.endswith("Z"):
            s = s[:-1]
        return datetime.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def open_db(path: str) -> sqlite3.Connection | None:
    """Open a SQLite database with Row factory, or None on failure."""
    try:
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        print(f"FAIL: Could not open database {path}: {e}")
        return None


def find_event(cursor, start: datetime, end: datetime):
    """Return the first user-1 event whose UTC instants match (start, end), or None."""
    cursor.execute(
        "SELECT id, title, start_time, end_time, event_type FROM calendar_event WHERE user_id = 1",
    )
    for row in cursor.fetchall():
        if parse_iso(row["start_time"]) == start and parse_iso(row["end_time"]) == end:
            return row
    return None


def check_old_event_deleted():
    """Old meeting event should no longer exist."""
    conn = open_db(CALENDAR_DB_PATH)
    if not conn:
        return 0.0
    row = find_event(conn.cursor(), OLD_START, OLD_END)
    conn.close()

    if row is None:
        print("PASS: Old meeting event has been deleted")
        return 0.33
    print(
        f"FAIL: Old meeting event still exists (id={row['id']}, title='{row['title']}')"
    )
    return 0.0


def check_new_event_created():
    """New rescheduled meeting event should exist."""
    conn = open_db(CALENDAR_DB_PATH)
    if not conn:
        return 0.0
    row = find_event(conn.cursor(), NEW_START, NEW_END)
    conn.close()

    if row:
        print(
            f"PASS: New meeting event exists (id={row['id']}, title='{row['title']}', type='{row['event_type']}')"
        )
        return 0.34
    print("FAIL: New meeting event not found for the rescheduled time")
    return 0.0


def check_confirmation_email():
    """Confirmation email should be sent to HR."""
    conn = open_db(EMAIL_DB_PATH)
    if not conn:
        return 0.0
    cursor = conn.cursor()
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

    has_reschedule = (
        "reschedule" in subject_lower
        or "reschedule" in body_lower
        or "confirm" in subject_lower
    )
    has_new_time = (
        "may 23" in body_lower or "10:00" in body_lower or "saturday" in body_lower
    )

    if has_reschedule and has_new_time:
        print(f"PASS: Confirmation email sent (subject='{row['subject']}')")
        return 0.33

    if has_reschedule or has_new_time:
        print(
            f"PARTIAL: Email sent but missing some details (subject='{row['subject']}')"
        )
        return 0.15

    print(
        f"FAIL: Email sent but doesn't confirm reschedule (subject='{row['subject']}')"
    )
    return 0.0


def main():
    scores = [
        check_old_event_deleted(),
        check_new_event_created(),
        check_confirmation_email(),
    ]
    total = sum(scores)
    print(f"Score: {total:.2f}/1.0")
    sys.exit(0 if total >= 0.9 else 1)


if __name__ == "__main__":
    main()
