#!/usr/bin/env python3
"""Verify candidate-interview-slot-confirm task:
1. Calendar event created for interview (May 26, 2:00-3:00 PM).
2. Confirmation email sent to hr.department.
"""

import sqlite3
import sys
from datetime import datetime

CALENDAR_DB_PATH = "/var/lib/mock-data/calendar/calendar.db"
EMAIL_DB_PATH = "/var/lib/mock-data/email/email.db"

EXPECTED_START = datetime(2026, 5, 26, 14, 0, 0)
EXPECTED_END = datetime(2026, 5, 26, 15, 0, 0)


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


def check_calendar_event():
    """Interview calendar event should exist."""
    conn = open_db(CALENDAR_DB_PATH)
    if not conn:
        return 0.0
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, title, start_time, end_time, event_type, description FROM calendar_event WHERE user_id = 1",
    )
    matched = None
    for row in cursor.fetchall():
        if (
            parse_iso(row["start_time"]) == EXPECTED_START
            and parse_iso(row["end_time"]) == EXPECTED_END
        ):
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
        print(
            "PARTIAL: Calendar event exists at correct time but title doesn't reference interview"
        )
        return 0.35
    print("FAIL: No calendar event found for the interview time slot")
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

    has_interview = (
        "interview" in subject_lower
        or "interview" in body_lower
        or "confirm" in subject_lower
    )
    has_date = (
        "may 26" in body_lower
        or "2:00" in body_lower
        or "tuesday" in body_lower
        or "3:00" in body_lower
    )

    if has_interview and has_date:
        print(f"PASS: Confirmation email sent (subject='{row['subject']}')")
        return 0.5

    if has_interview or has_date:
        print(
            f"PARTIAL: Email sent but missing some details (subject='{row['subject']}')"
        )
        return 0.25

    print(
        f"FAIL: Email sent but doesn't confirm interview (subject='{row['subject']}')"
    )
    return 0.0


def main():
    scores = [
        check_calendar_event(),
        check_confirmation_email(),
    ]
    total = sum(scores)
    print(f"Score: {total:.2f}/1.0")
    sys.exit(0 if total >= 0.9 else 1)


if __name__ == "__main__":
    main()
