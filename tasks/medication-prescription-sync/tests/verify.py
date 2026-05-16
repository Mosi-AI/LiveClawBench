#!/usr/bin/env python3
"""Verify medication-prescription-sync task:
1. Old medications (Glipizide, Acarbose) archived in health DB.
2. New medication (Metformin 500mg) created in health DB.
3. Calendar events exist for new medication intake times (8:00 AM and 6:00 PM).
4. Stale calendar reminders for old medications deleted.
"""

import sqlite3
import sys
from datetime import datetime

HEALTH_DB_PATH = "/workspace/health.db"
CALENDAR_DB_PATH = "/var/lib/mock-data/calendar/calendar.db"

ACTIVE_MED_SLOTS = []


def parse_iso(s):
    """Parse ISO-8601 datetime tolerating T/space separators and optional 'Z' suffix.

    The calendar mock stores whatever timestamp string the agent submits, so
    the verifier must accept both '2026-05-17T08:00:00' and '2026-05-17T08:00:00Z'.
    Returns a naive datetime; both sides of any comparison go through the same
    normalization so the implicit UTC offset cancels.
    """
    if not s:
        raise ValueError("empty timestamp")
    s = s.strip()
    if " " in s and "T" not in s:
        s = s.replace(" ", "T", 1)
    if s.endswith("Z"):
        s = s[:-1]
    return datetime.fromisoformat(s)


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
    """Metformin should be created and active with correct intake slots."""
    global ACTIVE_MED_SLOTS
    try:
        conn = sqlite3.connect(HEALTH_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open health database: {e}")
        return 0.0

    cursor.execute("SELECT id, name, frequency, dose_amount, dose_unit, archived FROM medication WHERE name LIKE '%Metformin%' AND archived = 0")
    row = cursor.fetchone()

    if not row:
        conn.close()
        print("FAIL: Metformin not found in active medications")
        return 0.0

    med_id = row["id"]

    cursor.execute("SELECT time_hhmm FROM medication_intake_slot WHERE medication_id = ?", (med_id,))
    slot_rows = cursor.fetchall()
    conn.close()

    slot_times = sorted(r["time_hhmm"] for r in slot_rows)
    ACTIVE_MED_SLOTS = slot_times

    dose_ok = row["frequency"] == "daily" and row["dose_amount"] == 500.0 and row["dose_unit"] == "mg"
    needed = {"08:00", "18:00"}
    slots_ok = needed.issubset(set(slot_times))

    if dose_ok and slots_ok:
        print(f"PASS: Metformin 500mg created with intake slots {slot_times} (id={med_id})")
        return 0.25
    if dose_ok:
        print(f"PARTIAL: Metformin 500mg created but intake slots {slot_times} missing {sorted(needed - set(slot_times))}")
        return 0.15
    print(f"PARTIAL: Metformin found but details differ (freq={row['frequency']}, dose={row['dose_amount']} {row['dose_unit']})")
    return 0.1


def check_calendar_new_med_events():
    """Calendar events for new medication must match health intake slots.

    Reads the active Metformin's medication_intake_slot rows from the health
    DB (populated by check_new_medication_created) and requires one
    event_type='medication' calendar event whose start_time HH:MM matches
    each slot. This ties calendar credit to the health service's recorded
    intake schedule rather than hard-coded hours.
    """
    if not ACTIVE_MED_SLOTS:
        print("FAIL: No intake slots from health DB to match calendar against")
        return 0.0

    try:
        conn = sqlite3.connect(CALENDAR_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open calendar database: {e}")
        return 0.0

    cursor.execute(
        "SELECT id, title, start_time FROM calendar_event WHERE user_id = 1 AND event_type = 'medication'"
    )
    rows = cursor.fetchall()
    conn.close()

    metformin_rows = [r for r in rows if "metformin" in (r["title"] or "").lower()]
    if not metformin_rows:
        print(f"FAIL: No Metformin calendar events found ({len(rows)} medication events)")
        return 0.0

    event_hhmm = set()
    for r in metformin_rows:
        try:
            dt = parse_iso(r["start_time"])
            event_hhmm.add(f"{dt.hour:02d}:{dt.minute:02d}")
        except Exception as e:
            print(f"WARN: could not parse start_time '{r['start_time']}': {e}")
            continue

    needed = set(ACTIVE_MED_SLOTS)
    matched = needed & event_hhmm
    if matched == needed:
        print(f"PASS: Metformin calendar events match health intake slots {sorted(matched)} ({len(metformin_rows)} events)")
        return 0.25
    if matched:
        print(
            f"PARTIAL: Metformin calendar events match {sorted(matched)} but missing "
            f"{sorted(needed - matched)} (got {sorted(event_hhmm)})"
        )
        return 0.1
    print(
        f"FAIL: Metformin events do not match intake slots {sorted(needed)} "
        f"(found {sorted(event_hhmm)})"
    )
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
