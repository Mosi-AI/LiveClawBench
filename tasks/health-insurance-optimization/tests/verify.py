#!/usr/bin/env python3
"""Verify health-insurance-optimization task:
   1. Check if a $250 reimbursement claim was submitted.
   2. Check if Blood Test appointment was booked with correct snapshot.
   3. Check if Diet Consultation appointment was booked with correct snapshot.
   4. Check if two non-overlapping calendar events were created.
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

    # Check for a claim with total_amount = 25000 for user 1
    # Seed claims have status submitted/reviewing/reimbursed, so check for any
    # claim with the target amount that was NOT one of the 3 original seed claims
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
    return 0.1


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
    return 0.1


def check_calendar_events():
    try:
        conn = sqlite3.connect(CALENDAR_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open calendar database: {e}")
        return 0.0

    # Check for at least 2 non-overlapping events for user 1
    cursor.execute(
        """
        SELECT id, title, start_time, end_time
        FROM calendar_event
        WHERE user_id = 1
        ORDER BY start_time
        """
    )
    rows = cursor.fetchall()
    conn.close()

    if len(rows) < 2:
        print(f"FAIL: Expected at least 2 calendar events, found {len(rows)}")
        return 0.0

    print(f"Calendar events found: {len(rows)}")
    for row in rows:
        print(f"  - id={row['id']}, title={row['title']}, start={row['start_time']}, end={row['end_time']}")

    # Check that at least 2 events do not overlap
    # Two events overlap if: start1 < end2 AND start2 < end1
    non_overlapping_pair = False
    for i in range(len(rows)):
        for j in range(i + 1, len(rows)):
            s1, e1 = rows[i]["start_time"], rows[i]["end_time"]
            s2, e2 = rows[j]["start_time"], rows[j]["end_time"]
            # No overlap if one ends before or at the other starts
            if e1 <= s2 or e2 <= s1:
                non_overlapping_pair = True
                print(f"PASS: Non-overlapping pair found: '{rows[i]['title']}' and '{rows[j]['title']}'")
                break
        if non_overlapping_pair:
            break

    if not non_overlapping_pair:
        print("FAIL: No non-overlapping pair of calendar events found")
        return 0.0

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
