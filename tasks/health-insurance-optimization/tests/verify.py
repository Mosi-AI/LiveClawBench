#!/usr/bin/env python3
"""Verify health-insurance-optimization task:
   1. Check if a $250 reimbursement claim was submitted.
   2. Check if Blood Test appointment was booked with correct snapshot.
   3. Check if Diet Consultation appointment was booked with correct snapshot.
   4. Check if two calendar events exist that match the booked appointment times
      and have corresponding titles, and that they do not overlap.
"""

import sqlite3
import sys

INSURANCE_DB_PATH = "/var/lib/mock-data/insurance/insurance.db"
CALENDAR_DB_PATH = "/var/lib/mock-data/calendar/calendar.db"

CLAIM_AMOUNT = 25000  # $250 in cents
BLOOD_TEST_COST = 2500  # $25 in cents
DIET_CONSULT_COST = 5000  # $50 in cents


def check_claim():
    try:
        conn = sqlite3.connect(INSURANCE_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open insurance database: {e}")
        return 0.0

    cursor.execute(
        """
        SELECT id, total_amount, provider_name, check_item, status
        FROM claim
        WHERE user_id = 1
          AND total_amount = ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (CLAIM_AMOUNT,),
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        print(f"FAIL: No claim found with total_amount={CLAIM_AMOUNT} for user 1")
        return 0.0

    print(
        f"Claim: id={row['id']}, amount={row['total_amount']}, "
        f"provider={row['provider_name']}, check_item={row['check_item']}, "
        f"status={row['status']}"
    )

    if row["total_amount"] == CLAIM_AMOUNT:
        print("PASS: Reimbursement claim submitted with correct amount")
        return 0.25

    print(f"FAIL: Claim amount mismatch (expected {CLAIM_AMOUNT}, got {row['total_amount']})")
    return 0.0


def check_blood_test_appointment():
    try:
        conn = sqlite3.connect(INSURANCE_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open insurance database: {e}")
        return 0.0

    cursor.execute(
        """
        SELECT id, service_name_snapshot, cost_snapshot, provider_name
        FROM appointment
        WHERE user_id = 1
          AND service_name_snapshot = 'Blood Test'
        ORDER BY id DESC
        LIMIT 1
        """
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        print("FAIL: No Blood Test appointment found for user 1")
        return 0.0

    print(
        f"Blood Test: id={row['id']}, service={row['service_name_snapshot']}, "
        f"cost={row['cost_snapshot']}, provider={row['provider_name']}"
    )

    if row["cost_snapshot"] == BLOOD_TEST_COST:
        print("PASS: Blood Test appointment booked with correct snapshot")
        return 0.25

    print(f"PARTIAL: Blood Test booked but cost_snapshot={row['cost_snapshot']} (expected {BLOOD_TEST_COST})")
    return 0.0


def check_diet_consultation_appointment():
    try:
        conn = sqlite3.connect(INSURANCE_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open insurance database: {e}")
        return 0.0

    cursor.execute(
        """
        SELECT id, service_name_snapshot, cost_snapshot, provider_name
        FROM appointment
        WHERE user_id = 1
          AND service_name_snapshot = 'Diet Consultation'
        ORDER BY id DESC
        LIMIT 1
        """
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        print("FAIL: No Diet Consultation appointment found for user 1")
        return 0.0

    print(
        f"Diet Consultation: id={row['id']}, service={row['service_name_snapshot']}, "
        f"cost={row['cost_snapshot']}, provider={row['provider_name']}"
    )

    if row["cost_snapshot"] == DIET_CONSULT_COST:
        print("PASS: Diet Consultation appointment booked with correct snapshot")
        return 0.25

    print(f"PARTIAL: Diet Consultation booked but cost_snapshot={row['cost_snapshot']} (expected {DIET_CONSULT_COST})")
    return 0.0


def check_calendar_events():
    """Verify two calendar events exist whose times match the booked appointments."""
    try:
        ins_conn = sqlite3.connect(INSURANCE_DB_PATH)
        ins_conn.row_factory = sqlite3.Row
        ins_cursor = ins_conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open insurance database: {e}")
        return 0.0

    # Read the booked appointment times
    ins_cursor.execute(
        """
        SELECT service_name_snapshot, slot_start_time, slot_end_time
        FROM appointment
        WHERE user_id = 1
          AND service_name_snapshot IN ('Blood Test', 'Diet Consultation')
        ORDER BY id
        """
    )
    appointments = ins_cursor.fetchall()
    ins_conn.close()

    if len(appointments) < 2:
        print(f"FAIL: Expected 2 insurance appointments, found {len(appointments)}")
        return 0.0

    # Build expected calendar events from appointment snapshots
    expected = {}
    for appt in appointments:
        name = appt["service_name_snapshot"]
        expected[name] = {
            "start": appt["slot_start_time"],
            "end": appt["slot_end_time"],
        }

    try:
        cal_conn = sqlite3.connect(CALENDAR_DB_PATH)
        cal_conn.row_factory = sqlite3.Row
        cal_cursor = cal_conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open calendar database: {e}")
        return 0.0

    cal_cursor.execute(
        """
        SELECT id, title, start_time, end_time
        FROM calendar_event
        WHERE user_id = 1
        ORDER BY start_time
        """
    )
    cal_events = cal_cursor.fetchall()
    cal_conn.close()

    if len(cal_events) < 2:
        print(f"FAIL: Expected at least 2 calendar events, found {len(cal_events)}")
        return 0.0

    # Match calendar events to appointment snapshots by title and exact times
    matched = 0
    for name, times in expected.items():
        for evt in cal_events:
            title_lower = (evt["title"] or "").lower()
            if name.lower() in title_lower and evt["start_time"] == times["start"] and evt["end_time"] == times["end"]:
                matched += 1
                print(f"Calendar match: '{evt['title']}' at {evt['start_time']} - {evt['end_time']} == {name}")
                break

    if matched < 2:
        print(f"FAIL: Only {matched}/2 calendar events match the booked appointment times")
        print(f"Expected: {expected}")
        print(f"Found: {[(e['title'], e['start_time'], e['end_time']) for e in cal_events]}")
        return 0.0

    # Verify the two matched events don't overlap
    matched_events = []
    for name, times in expected.items():
        for evt in cal_events:
            title_lower = (evt["title"] or "").lower()
            if name.lower() in title_lower and evt["start_time"] == times["start"] and evt["end_time"] == times["end"]:
                matched_events.append(evt)
                break

    if len(matched_events) == 2:
        s1, e1 = matched_events[0]["start_time"], matched_events[0]["end_time"]
        s2, e2 = matched_events[1]["start_time"], matched_events[1]["end_time"]
        if e1 <= s2 or e2 <= s1:
            print("PASS: Calendar events match appointment times and do not overlap")
            return 0.25
        else:
            print("FAIL: Calendar events overlap")
            return 0.0

    print("PASS: Calendar events match appointment times")
    return 0.25


def main():
    scores = []
    scores.append(check_claim())
    scores.append(check_blood_test_appointment())
    scores.append(check_diet_consultation_appointment())
    scores.append(check_calendar_events())

    total = sum(scores)
    print(f"Score: {total:.2f}/1.00")

    # All four parts must pass for a successful exit
    all_passed = all(s >= 0.25 for s in scores)
    sys.exit(0 if all_passed and total >= 1.0 else 1)


if __name__ == "__main__":
    main()
