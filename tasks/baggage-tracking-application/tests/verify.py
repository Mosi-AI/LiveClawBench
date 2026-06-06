#!/usr/bin/env python3
"""Verify baggage-tracking-application task: check baggage report submitted correctly.

PR-6 / B6.2 ③ — verifier-backend alignment
==========================================

PR-3 (commit ``3bd33dbd``) moved this task's airline backend to the Bun
``mock-airline`` binary, which writes to ``/var/lib/mock-data/airline/airline.db``
(Bun SQLite, schema in ``mock-platform/mocks/airline/src/db/schema.ts``).
The Flask airline-app DB was no longer reachable, so baggage reports the
agent submitted via the UI lived in the mock DB and this verifier saw
nothing. Rewrite to query the mock DB directly via stdlib sqlite3.

Scoring (unchanged): each of 10 checks is worth 1/10 of the total
(8 required fields + 2 description-keyword checks).
"""

import sqlite3
import sys

AIRLINE_DB_PATH = "/var/lib/mock-data/airline/airline.db"
PETER_EMAIL = "peter.griffin@work.mosi.inc"


def check() -> float:
    try:
        conn = sqlite3.connect(f"file:{AIRLINE_DB_PATH}?mode=ro", uri=True)
    except sqlite3.OperationalError as exc:
        print(f"FAIL: mock-airline DB not reachable at {AIRLINE_DB_PATH}: {exc}")
        return 0.0
    conn.row_factory = sqlite3.Row
    try:
        peter = conn.execute(
            "SELECT id, email FROM users WHERE email = ?", (PETER_EMAIL,)
        ).fetchone()
        if peter is None:
            print(f"FAIL: Peter Griffin user not found (email={PETER_EMAIL})")
            return 0.0

        report = conn.execute(
            "SELECT id, flight_number, flight_time, seat_number, passenger_name, "
            "passenger_phone, passenger_email, baggage_description, loss_details "
            "FROM baggage_tracking WHERE user_id = ? "
            "ORDER BY created_at DESC LIMIT 1",
            (peter["id"],),
        ).fetchone()
    finally:
        conn.close()

    if report is None:
        print("FAIL: No baggage report found for Peter Griffin")
        return 0.0

    print(f"Found baggage report for Peter Griffin (ID: {report['id']})")

    total_points = 0
    max_points = 0

    # Field-level checks: (field_name, value, expected_value_or_None_for_nonempty)
    fields_to_check = [
        ("flight_number", report["flight_number"], "GKD888"),
        ("flight_time", report["flight_time"], None),
        ("seat_number", report["seat_number"], None),
        ("passenger_name", report["passenger_name"], "Peter Griffin"),
        ("passenger_phone", report["passenger_phone"], None),
        ("passenger_email", report["passenger_email"], "peter.griffin@work.mosi.inc"),
        ("baggage_description", report["baggage_description"], None),
        ("loss_details", report["loss_details"], None),
    ]

    for field_name, field_value, expected_value in fields_to_check:
        max_points += 1
        if field_value is not None and str(field_value).strip():
            if expected_value is None:
                print(f"  ✓ {field_name}: {field_value}")
                total_points += 1
            elif field_value == expected_value:
                print(f"  ✓ {field_name}: {field_value}")
                total_points += 1
            else:
                print(
                    f"  ✗ {field_name}: Expected '{expected_value}', got '{field_value}'"
                )
        else:
            print(f"  ✗ {field_name}: Field is empty or None")

    # Description keyword checks
    desc = (report["baggage_description"] or "").lower()

    max_points += 1
    if "20-inch" in desc or "20 inch" in desc:
        print("  ✓ baggage_description contains '20-inch'")
        total_points += 1
    else:
        print("  ✗ baggage_description missing '20-inch'")

    max_points += 1
    if "black" in desc:
        print("  ✓ baggage_description contains 'black'")
        total_points += 1
    else:
        print("  ✗ baggage_description missing 'black'")

    score = total_points / max_points if max_points > 0 else 0.0

    print(f"\nTotal points: {total_points}/{max_points}")
    print(f"Normalized score: {score:.2f}")

    return score


score = check()
print(f"Score: {score}/1.0")
sys.exit(0 if score >= 1.0 else 1)
