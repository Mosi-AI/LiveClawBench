#!/usr/bin/env python3
"""Verify health-insurance-optimization task:
   1. Check if Balanced Silver plan was selected.
   2. Check if Preventive Care appointment was scheduled on 2026-05-15 09:00 UTC.
"""

import sqlite3
import sys

INSURANCE_DB_PATH = "/var/lib/mock-data/insurance/insurance.db"
CALENDAR_DB_PATH = "/var/lib/mock-data/calendar/calendar.db"

VALID_PLANS = {
    "A": "Budget HDHP",
    "B": "Balanced Silver",
    "C": "Premier Gold",
}


def check_insurance():
    try:
        conn = sqlite3.connect(INSURANCE_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open insurance database: {e}")
        return 0.0

    cursor.execute(
        """
        SELECT plan_code_snapshot, plan_name_snapshot, year,
               deductible_snapshot, premium_snapshot
        FROM plan_selection
        WHERE user_id = 1
        ORDER BY id DESC
        LIMIT 1
        """
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        print("FAIL: No plan selection found for user 1")
        return 0.0

    plan_code = row["plan_code_snapshot"]
    plan_name = row["plan_name_snapshot"]
    print(
        f"Insurance: code={plan_code}, name={plan_name}, "
        f"deductible={row['deductible_snapshot']}, premium={row['premium_snapshot']}"
    )

    if plan_code == "B" and plan_name == "Balanced Silver":
        print("PASS: Balanced Silver plan selected correctly")
        return 0.5

    if plan_code in VALID_PLANS and plan_name == VALID_PLANS[plan_code]:
        print(f"PARTIAL: Valid plan selected but not Balanced Silver (got {plan_name})")
        return 0.25

    print(f"FAIL: Unexpected plan selection (code={plan_code}, name={plan_name})")
    return 0.0


def check_calendar():
    try:
        conn = sqlite3.connect(CALENDAR_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open calendar database: {e}")
        return 0.0

    cursor.execute(
        """
        SELECT title, start_time, end_time
        FROM calendar_event
        WHERE user_id = 1
          AND title LIKE '%Preventive Care%'
          AND start_time = '2026-05-15T09:00:00Z'
          AND end_time = '2026-05-15T10:00:00Z'
        LIMIT 1
        """
    )
    row = cursor.fetchone()

    # Also accept any title containing "Preventive Care" at the right time
    if not row:
        cursor.execute(
            """
            SELECT title, start_time, end_time
            FROM calendar_event
            WHERE user_id = 1
              AND start_time = '2026-05-15T09:00:00Z'
            LIMIT 1
            """
        )
        row = cursor.fetchone()

    conn.close()

    if not row:
        print("FAIL: No calendar event found for 2026-05-15T09:00:00Z")
        return 0.0

    print(
        f"Calendar: title={row['title']}, start={row['start_time']}, end={row['end_time']}"
    )

    if row["title"] and "preventive care" in row["title"].lower():
        print("PASS: Preventive Care appointment scheduled correctly")
        return 0.5

    print(f"PARTIAL: Event scheduled but title mismatch (got '{row['title']}')")
    return 0.25


def main():
    insurance_score = check_insurance()
    calendar_score = check_calendar()
    total = insurance_score + calendar_score
    print(f"Score: {total:.1f}/1.0")
    sys.exit(0 if total >= 0.5 else 1)


if __name__ == "__main__":
    main()
