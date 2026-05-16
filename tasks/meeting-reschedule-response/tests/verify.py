#!/usr/bin/env python3
"""Verify meeting-reschedule-response task:
1. Old meeting event (Thursday May 22 2:00-3:00 PM) deleted from calendar.
2. New meeting event (Friday May 23 10:00-11:00 AM) exists in calendar.
3. Confirmation email sent to hr.department.
"""

import sqlite3
import sys

CALENDAR_DB_PATH = "/var/lib/mock-data/calendar/calendar.db"
EMAIL_DB_PATH = "/var/lib/mock-data/email/email.db"

OLD_START = "2026-05-22T14:00:00"
OLD_END = "2026-05-22T15:00:00"
NEW_START = "2026-05-23T10:00:00"
NEW_END = "2026-05-23T11:00:00"


def check_old_event_deleted():
    """Old meeting event should no longer exist."""
    try:
        conn = sqlite3.connect(CALENDAR_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open calendar database: {e}")
        return 0.0

    cursor.execute(
        "SELECT id, title, start_time, end_time FROM calendar_event WHERE user_id = 1 AND start_time = ? AND end_time = ?",
        (OLD_START, OLD_END),
    )
    row = cursor.fetchone()
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

    cursor.execute(
        "SELECT id, title, start_time, end_time, event_type FROM calendar_event WHERE user_id = 1 AND start_time = ? AND end_time = ?",
        (NEW_START, NEW_END),
    )
    row = cursor.fetchone()
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
