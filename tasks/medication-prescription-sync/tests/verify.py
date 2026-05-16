#!/usr/bin/env python3
"""Verify medication-prescription-sync task:
1. Old medications (Glipizide, Acarbose) archived in health DB.
2. New medication (Metformin 500mg) created in health DB.
3. Calendar events exist for new medication intake times (8:00 AM and 6:00 PM).
4. Stale calendar reminders for old medications deleted.
"""

import sqlite3
import sys

HEALTH_DB_PATH = "/workspace/health.db"
CALENDAR_DB_PATH = "/var/lib/mock-data/calendar/calendar.db"


def check_old_medications_archived():
    """Old medications should be archived."""
    try:
        conn = sqlite3.connect(HEALTH_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open health database: {e}")
        return 0.0

    score = 0.0
    for med_name in ["Glipizide", "Acarbose"]:
        cursor.execute("SELECT id, name, archived, archived_at FROM medication WHERE name = ?", (med_name,))
        row = cursor.fetchone()
        if row and row["archived"] == 1:
            print(f"PASS: {med_name} archived")
            score += 0.125
        else:
            print(f"FAIL: {med_name} not archived")
    conn.close()
    return score


def check_new_medication_created():
    """Metformin should be created and active."""
    try:
        conn = sqlite3.connect(HEALTH_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open health database: {e}")
        return 0.0

    cursor.execute("SELECT id, name, frequency, dose_amount, dose_unit, archived FROM medication WHERE name LIKE '%Metformin%' AND archived = 0")
    row = cursor.fetchone()
    conn.close()

    if not row:
        print("FAIL: Metformin not found in active medications")
        return 0.0

    if row["frequency"] == "daily" and row["dose_amount"] == 500.0 and row["dose_unit"] == "mg":
        print(f"PASS: Metformin 500mg created (id={row['id']}, frequency={row['frequency']})")
        return 0.25

    print(f"PARTIAL: Metformin found but details differ (freq={row['frequency']}, dose={row['dose_amount']} {row['dose_unit']})")
    return 0.1


def check_calendar_new_med_events():
    """Calendar events for new medication intake should exist."""
    try:
        conn = sqlite3.connect(CALENDAR_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open calendar database: {e}")
        return 0.0

    cursor.execute(
        "SELECT id, title, event_type FROM calendar_event WHERE user_id = 1 AND event_type = 'medication'"
    )
    rows = cursor.fetchall()
    conn.close()

    titles_lower = [(r["title"] or "").lower() for r in rows]
    has_metformin = any("metformin" in t for t in titles_lower)

    if has_metformin:
        print(f"PASS: Calendar medication events include Metformin ({len(rows)} medication events total)")
        return 0.25

    print(f"FAIL: No Metformin calendar events found ({len(rows)} medication events)")
    return 0.0


def check_stale_events_cleaned():
    """Stale calendar reminders for old medications should be deleted."""
    try:
        conn = sqlite3.connect(CALENDAR_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open calendar database: {e}")
        return 0.0

    cursor.execute(
        "SELECT id, title FROM calendar_event WHERE user_id = 1 AND (title LIKE '%Glipizide%' OR title LIKE '%Acarbose%')"
    )
    rows = cursor.fetchall()
    conn.close()

    if len(rows) == 0:
        print("PASS: Stale medication calendar events cleaned up")
        return 0.25

    print(f"FAIL: {len(rows)} stale medication events still exist: {[r['title'] for r in rows]}")
    return 0.0


def main():
    scores = []
    scores.append(check_old_medications_archived())
    scores.append(check_new_medication_created())
    scores.append(check_calendar_new_med_events())
    scores.append(check_stale_events_cleaned())

    total = sum(scores)
    print(f"Score: {total:.2f}/1.0")
    sys.exit(0 if total >= 0.9 else 1)


if __name__ == "__main__":
    main()
