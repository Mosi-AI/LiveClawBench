#!/usr/bin/env python3
"""Verify candidate-interview-slot-confirm task:
1. Calendar event created for interview (May 26, 2:00-3:00 PM).
2. Confirmation email sent to hr.department.
"""

import sqlite3
import sys
from datetime import datetime, timezone

CALENDAR_DB_PATH = "/var/lib/mock-data/calendar/calendar.db"
EMAIL_DB_PATH = "/var/lib/mock-data/email/email.db"

# Wall-clock instants the agent must produce in the calendar (UTC).
# The mock stores ISO 8601 with ".000Z" suffix via Date.toISOString(); we compare
# as parsed datetimes to be robust to format differences (Z vs +00:00, ms suffix).
EXPECTED_START = datetime(2026, 5, 26, 14, 0, 0, tzinfo=timezone.utc)
EXPECTED_END = datetime(2026, 5, 26, 15, 0, 0, tzinfo=timezone.utc)


def parse_iso(value: str) -> datetime | None:
    """Parse an ISO 8601 string into a UTC datetime, or None on failure."""
    if not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except (ValueError, TypeError):
        return None


def check_calendar_event():
    """Interview calendar event should exist."""
    try:
        conn = sqlite3.connect(CALENDAR_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open calendar database: {e}")
        return 0.0

    cursor.execute(
        "SELECT id, title, start_time, end_time, event_type, description FROM calendar_event WHERE user_id = 1",
    )
    matched = None
    for row in cursor.fetchall():
        row_start = parse_iso(row["start_time"])
        row_end = parse_iso(row["end_time"])
        if row_start == EXPECTED_START and row_end == EXPECTED_END:
            matched = row
            break
    conn.close()

    if matched:
        title_lower = (matched["title"] or "").lower()
        has_interview = (
            "interview" in title_lower
            or "candidate" in title_lower
            or "alex" in title_lower
            or "developer" in title_lower
        )
        print(
            f"Found event: id={matched['id']}, title='{matched['title']}', "
            f"type='{matched['event_type']}'"
        )
        if has_interview:
            print("PASS: Interview calendar event created with relevant title")
            return 0.5
        print("PARTIAL: Calendar event exists at correct time but title doesn't reference interview")
        return 0.35
    print("FAIL: No calendar event found for the interview time slot")
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

    has_interview = "interview" in subject_lower or "interview" in body_lower or "confirm" in subject_lower
    has_date = "may 26" in body_lower or "2:00" in body_lower or "tuesday" in body_lower or "3:00" in body_lower

    if has_interview and has_date:
        print(f"PASS: Confirmation email sent (subject='{row['subject']}')")
        return 0.5

    if has_interview or has_date:
        print(f"PARTIAL: Email sent but missing some details (subject='{row['subject']}')")
        return 0.25

    print(f"FAIL: Email sent but doesn't confirm interview (subject='{row['subject']}')")
    return 0.0


def main():
    scores = []
    scores.append(check_calendar_event())
    scores.append(check_confirmation_email())

    total = sum(scores)
    print(f"Score: {total:.2f}/1.0")
    sys.exit(0 if total >= 0.9 else 1)


if __name__ == "__main__":
    main()
