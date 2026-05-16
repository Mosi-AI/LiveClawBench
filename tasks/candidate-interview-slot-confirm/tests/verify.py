#!/usr/bin/env python3
"""Verify candidate-interview-slot-confirm task:
1. Calendar event created for interview (May 26, 2:00-3:00 PM).
2. Confirmation email sent to hr.department.
"""

import sqlite3
import sys

CALENDAR_DB_PATH = "/var/lib/mock-data/calendar/calendar.db"
EMAIL_DB_PATH = "/var/lib/mock-data/email/email.db"

EXPECTED_START = "2026-05-26T14:00:00"
EXPECTED_END = "2026-05-26T15:00:00"


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
        "SELECT id, title, start_time, end_time, event_type, description FROM calendar_event WHERE user_id = 1 AND start_time = ? AND end_time = ?",
        (EXPECTED_START, EXPECTED_END),
    )
    row = cursor.fetchone()
    conn.close()

    if row:
        title_lower = (row["title"] or "").lower()
        has_interview = "interview" in title_lower or "candidate" in title_lower or "alex" in title_lower or "developer" in title_lower
        print(f"Found event: id={row['id']}, title='{row['title']}', type='{row['event_type']}'")
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
    has_date = "may 26" in body_lower or "2:00" in body_lower or "monday" in body_lower or "3:00" in body_lower

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
