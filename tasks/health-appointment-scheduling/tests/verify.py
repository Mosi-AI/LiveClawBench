#!/usr/bin/env python3
"""Verify health-appointment-scheduling task:
1. Out-of-network appointment cancelled in insurance DB.
2. New in-network appointment booked in insurance DB.
3. Calendar event matches the new in-network appointment time.
"""

import sqlite3
import sys
from datetime import datetime, timedelta

INSURANCE_DB_PATH = "/var/lib/mock-data/insurance/insurance.db"
CALENDAR_DB_PATH = "/var/lib/mock-data/calendar/calendar.db"

OUT_OF_NETWORK_PROVIDER = "Summit Out-of-Network Clinic"


def parse_iso(s):
    """Parse ISO-8601 datetime into a naive UTC datetime, tolerating T/space
    separators and optional 'Z' suffix. Raises ValueError on failure.
    """
    if not s:
        raise ValueError("empty timestamp")
    s = s.strip()
    if " " in s and "T" not in s:
        s = s.replace(" ", "T", 1)
    if s.endswith("Z"):
        s = s[:-1]
    return datetime.fromisoformat(s)


def open_db(path: str) -> sqlite3.Connection | None:
    """Open a SQLite database with Row factory, or None on failure."""
    try:
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        print(f"FAIL: Could not open database {path}: {e}")
        return None


def check_out_of_network_cancelled():
    """Out-of-network appointment should be cancelled."""
    conn = open_db(INSURANCE_DB_PATH)
    if not conn:
        return 0.0
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, provider_name, status FROM appointment WHERE user_id = 1 AND provider_name = ?",
        (OUT_OF_NETWORK_PROVIDER,),
    )
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        print("PASS: Out-of-network appointment no longer exists")
        return 0.33

    all_cancelled = all(r["status"] == "cancelled" for r in rows)
    if all_cancelled:
        print(f"PASS: Out-of-network appointment(s) cancelled ({len(rows)})")
        return 0.33

    print(f"FAIL: Out-of-network appointment still active: {[dict(r) for r in rows]}")
    return 0.0


def check_in_network_booked():
    """New in-network appointment should exist and be confirmed."""
    conn = open_db(INSURANCE_DB_PATH)
    if not conn:
        return 0.0
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT a.id, a.provider_name, a.service_name_snapshot, a.slot_start_time, a.slot_end_time, a.status
        FROM appointment a
        JOIN provider p ON a.provider_id = p.id
        WHERE a.user_id = 1 AND p.network_status = 'in_network' AND a.status = 'confirmed'
        ORDER BY a.id DESC LIMIT 1
        """
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        print("FAIL: No confirmed in-network appointment found")
        return 0.0

    print(
        f"PASS: In-network appointment booked with {row['provider_name']} at {row['slot_start_time']}"
    )
    return 0.34


def check_calendar_event():
    """Calendar event must match the new in-network appointment time.

    Comparison uses parsed datetimes (parse_iso) rather than raw string
    equality so trailing 'Z' or naive UTC are both accepted. Only
    event_type='appointment' rows count. A delta within 1 minute on both
    endpoints is treated as a match.
    """
    ins_conn = open_db(INSURANCE_DB_PATH)
    if not ins_conn:
        return 0.0
    ins_cursor = ins_conn.cursor()
    ins_cursor.execute(
        """
        SELECT a.slot_start_time, a.slot_end_time, a.service_name_snapshot
        FROM appointment a
        JOIN provider p ON a.provider_id = p.id
        WHERE a.user_id = 1 AND p.network_status = 'in_network' AND a.status = 'confirmed'
        ORDER BY a.id DESC LIMIT 1
        """
    )
    appt = ins_cursor.fetchone()
    ins_conn.close()

    if not appt:
        print("FAIL: No in-network appointment to match calendar against")
        return 0.0

    try:
        appt_start = parse_iso(appt["slot_start_time"])
        appt_end = parse_iso(appt["slot_end_time"])
    except Exception as e:
        print(
            f"FAIL: Could not parse appointment times "
            f"({appt['slot_start_time']} - {appt['slot_end_time']}): {e}"
        )
        return 0.0

    cal_conn = open_db(CALENDAR_DB_PATH)
    if not cal_conn:
        return 0.0
    cal_cursor = cal_conn.cursor()
    cal_cursor.execute(
        "SELECT id, title, start_time, end_time, event_type FROM calendar_event "
        "WHERE user_id = 1 AND event_type = 'appointment'"
    )
    events = cal_cursor.fetchall()
    cal_conn.close()

    tolerance = timedelta(minutes=1)
    for evt in events:
        try:
            ev_start = parse_iso(evt["start_time"])
            ev_end = parse_iso(evt["end_time"])
        except Exception as e:
            print(f"WARN: could not parse event {evt['id']} times: {e}")
            continue
        if (
            abs(ev_start - appt_start) <= tolerance
            and abs(ev_end - appt_end) <= tolerance
        ):
            print(
                f"PASS: Appointment calendar event matches "
                f"(title='{evt['title']}', start={evt['start_time']})"
            )
            return 0.33

    print(
        f"FAIL: No event_type='appointment' calendar event within 1 min of "
        f"appointment ({appt['slot_start_time']} - {appt['slot_end_time']}); "
        f"checked {len(events)} appointment events"
    )
    return 0.0


def main():
    scores = [
        check_out_of_network_cancelled(),
        check_in_network_booked(),
        check_calendar_event(),
    ]
    total = sum(scores)
    print(f"Score: {total:.2f}/1.0")
    sys.exit(0 if total >= 0.9 else 1)


if __name__ == "__main__":
    main()
