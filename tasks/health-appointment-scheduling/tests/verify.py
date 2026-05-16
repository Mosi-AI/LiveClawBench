#!/usr/bin/env python3
"""Verify health-appointment-scheduling task:
1. Out-of-network appointment cancelled in insurance DB.
2. New in-network appointment booked in insurance DB.
3. Calendar event matches the new in-network appointment time.
"""

import sqlite3
import sys

INSURANCE_DB_PATH = "/var/lib/mock-data/insurance/insurance.db"
CALENDAR_DB_PATH = "/var/lib/mock-data/calendar/calendar.db"

OUT_OF_NETWORK_PROVIDER = "Summit Out-of-Network Clinic"


def check_out_of_network_cancelled():
    """Out-of-network appointment should be cancelled."""
    try:
        conn = sqlite3.connect(INSURANCE_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open insurance database: {e}")
        return 0.0

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
    try:
        conn = sqlite3.connect(INSURANCE_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open insurance database: {e}")
        return 0.0

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

    print(f"PASS: In-network appointment booked with {row['provider_name']} at {row['slot_start_time']}")
    return 0.34


def check_calendar_event():
    """Calendar event should match the new in-network appointment."""
    try:
        ins_conn = sqlite3.connect(INSURANCE_DB_PATH)
        ins_conn.row_factory = sqlite3.Row
        ins_cursor = ins_conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open insurance database: {e}")
        return 0.0

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
        cal_conn = sqlite3.connect(CALENDAR_DB_PATH)
        cal_conn.row_factory = sqlite3.Row
        cal_cursor = cal_conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open calendar database: {e}")
        return 0.0

    cal_cursor.execute(
        "SELECT id, title, start_time, end_time FROM calendar_event WHERE user_id = 1 AND start_time = ? AND end_time = ?",
        (appt["slot_start_time"], appt["slot_end_time"]),
    )
    evt = cal_cursor.fetchone()
    cal_conn.close()

    if evt:
        print(f"PASS: Calendar event matches appointment (title='{evt['title']}', time={evt['start_time']})")
        return 0.33

    print(f"FAIL: No calendar event matching appointment time ({appt['slot_start_time']} - {appt['slot_end_time']})")
    return 0.0


def main():
    scores = []
    scores.append(check_out_of_network_cancelled())
    scores.append(check_in_network_booked())
    scores.append(check_calendar_event())

    total = sum(scores)
    print(f"Score: {total:.2f}/1.0")
    sys.exit(0 if total >= 0.9 else 1)


if __name__ == "__main__":
    main()
