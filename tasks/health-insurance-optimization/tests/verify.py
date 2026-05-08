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
        SELECT id, claim_type, total_amount, provider_name, check_item,
               service_date, notes, status
        FROM claim
        WHERE user_id = 1
          AND total_amount = ?
          AND claim_type = 'reimbursement'
          AND provider_name = 'Metro Lab Services'
          AND check_item = 'lab'
          AND service_date = '2026-05-10'
        ORDER BY id DESC
        LIMIT 1
        """,
        (CLAIM_AMOUNT,),
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        print("FAIL: No matching reimbursement claim found for user 1")
        return 0.0

    print(
        f"Claim: id={row['id']}, type={row['claim_type']}, amount={row['total_amount']}, "
        f"provider={row['provider_name']}, check_item={row['check_item']}, "
        f"service_date={row['service_date']}, notes={row['notes']}, status={row['status']}"
    )

    notes = (row["notes"] or "").lower()
    if (
        row["total_amount"] == CLAIM_AMOUNT
        and row["claim_type"] == "reimbursement"
        and row["provider_name"] == "Metro Lab Services"
        and row["check_item"] == "lab"
        and row["service_date"] == "2026-05-10"
        and "blood work follow-up" in notes
    ):
        print("PASS: Reimbursement claim submitted with correct details")
        return 0.25

    if row["service_date"] != "2026-05-10":
        print(f"FAIL: service_date is {row['service_date']}, expected 2026-05-10")
    elif "blood work follow-up" not in notes:
        print(f"FAIL: notes '{row['notes']}' does not contain 'blood work follow-up'")
    else:
        print("FAIL: Claim details mismatch")
    return 0.0


def check_blood_test_appointment():
    return _check_appointment("Blood Test", BLOOD_TEST_COST)


def check_diet_consultation_appointment():
    return _check_appointment("Diet Consultation", DIET_CONSULT_COST)


def _check_appointment(service_name: str, expected_cost: int) -> float:
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
          AND service_name_snapshot = ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (service_name,),
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        print(f"FAIL: No {service_name} appointment found for user 1")
        return 0.0

    print(
        f"{service_name}: id={row['id']}, service={row['service_name_snapshot']}, "
        f"cost={row['cost_snapshot']}, provider={row['provider_name']}"
    )

    if row["cost_snapshot"] == expected_cost:
        print(f"PASS: {service_name} appointment booked with correct snapshot")
        return 0.25

    print(
        f"PARTIAL: {service_name} booked but cost_snapshot={row['cost_snapshot']} (expected {expected_cost})"
    )
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
    matched_events = []
    for name, times in expected.items():
        for evt in cal_events:
            title_lower = (evt["title"] or "").lower()
            if (
                name.lower() in title_lower
                and evt["start_time"] == times["start"]
                and evt["end_time"] == times["end"]
            ):
                matched_events.append(evt)
                print(
                    f"Calendar match: '{evt['title']}' at {evt['start_time']} - {evt['end_time']} == {name}"
                )
                break

    if len(matched_events) < 2:
        print(
            f"FAIL: Only {len(matched_events)}/2 calendar events match the booked appointment times"
        )
        print(f"Expected: {expected}")
        print(
            f"Found: {[(e['title'], e['start_time'], e['end_time']) for e in cal_events]}"
        )
        return 0.0

    # Verify the two matched events don't overlap
    s1, e1 = matched_events[0]["start_time"], matched_events[0]["end_time"]
    s2, e2 = matched_events[1]["start_time"], matched_events[1]["end_time"]
    if e1 <= s2 or e2 <= s1:
        print("PASS: Calendar events match appointment times and do not overlap")
        return 0.25

    print("FAIL: Calendar events overlap")
    return 0.0


def main():
    scores = []
    scores.append(check_claim())
    scores.append(check_blood_test_appointment())
    scores.append(check_diet_consultation_appointment())
    scores.append(check_calendar_events())

    total = sum(scores)
    print(f"Score: {total:.2f}/1.0")

    # All four parts must pass for a successful exit
    all_passed = all(s >= 0.25 for s in scores)
    sys.exit(0 if all_passed and total >= 1.0 else 1)


if __name__ == "__main__":
    main()
