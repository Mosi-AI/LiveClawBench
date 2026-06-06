#!/usr/bin/env python3
"""Verify flight-cancel-claim task: check if claim email sent correctly.

PR-6 / B6.2 ③ — verifier-backend alignment
==========================================

PR-3 (commit ``3bd33dbd``) moved both this task's airline backend AND
email backend to Bun mock binaries:

  * mock-airline → /var/lib/mock-data/airline/airline.db
    (schema: mock-platform/mocks/airline/src/db/schema.ts)
  * mock-email   → /var/lib/mock-data/email/email.db
    (schema: mock-platform/mocks/email/src/db.ts)

The Flask airline-app and email-app DBs are no longer the source of
truth, so any booking the agent saw and any claim email it sent lived
in the mock DBs. The previous verifier imported Flask SQLAlchemy
modules from /workspace/environment/{airline,email}-app/backend and
saw empty tables. Rewrite both reads to use stdlib sqlite3 against the
mock DBs.

Scoring (unchanged): 9 content checks, each worth 1/9 of total.
"""

import sqlite3
import sys

AIRLINE_DB_PATH = "/var/lib/mock-data/airline/airline.db"
EMAIL_DB_PATH = "/var/lib/mock-data/email/email.db"
PETER_EMAIL = "peter.griffin@work.mosi.inc"
TARGET_FLIGHT_NUMBER = "GKD2001"
CLAIM_RECIPIENT = "claims@gkdairlines.com"


def _connect_ro(path: str, label: str):
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.OperationalError as exc:
        print(f"FAIL: {label} DB not reachable at {path}: {exc}")
        return None


def check() -> float:
    air_conn = _connect_ro(AIRLINE_DB_PATH, "mock-airline")
    if air_conn is None:
        return 0.0
    try:
        peter = air_conn.execute(
            "SELECT id, email, phone FROM users WHERE email = ?", (PETER_EMAIL,)
        ).fetchone()
        if peter is None:
            print(f"FAIL: Peter Griffin user not found (email={PETER_EMAIL})")
            return 0.0

        flight = air_conn.execute(
            "SELECT id, flight_number, origin_city, destination_city, departure_time "
            "FROM flights WHERE flight_number = ?",
            (TARGET_FLIGHT_NUMBER,),
        ).fetchone()
        if flight is None:
            print(f"FAIL: Flight {TARGET_FLIGHT_NUMBER} not found")
            return 0.0

        booking = air_conn.execute(
            "SELECT booking_reference FROM bookings "
            "WHERE user_id = ? AND flight_id = ? LIMIT 1",
            (peter["id"], flight["id"]),
        ).fetchone()
        if booking is None:
            print(f"FAIL: No booking found for Peter on flight {TARGET_FLIGHT_NUMBER}")
            return 0.0
    finally:
        air_conn.close()

    print(f"Found cancelled flight: {flight['flight_number']}")
    print(f"  Route: {flight['origin_city']} -> {flight['destination_city']}")
    print(f"  Departure: {flight['departure_time']}")
    print(f"  Booking ref: {booking['booking_reference']}")

    email_conn = _connect_ro(EMAIL_DB_PATH, "mock-email")
    if email_conn is None:
        return 0.0
    try:
        claim_email = email_conn.execute(
            "SELECT id, subject, body FROM emails "
            "WHERE recipient_email = ? AND folder = 'sent' LIMIT 1",
            (CLAIM_RECIPIENT,),
        ).fetchone()
        if claim_email is None:
            print(f"FAIL: No email sent to {CLAIM_RECIPIENT}")
            return 0.0

        attachment_count = email_conn.execute(
            "SELECT COUNT(*) AS c FROM attachments WHERE email_id = ?",
            (claim_email["id"],),
        ).fetchone()["c"]
    finally:
        email_conn.close()

    print(f"\nFound claim email (ID: {claim_email['id']})")
    print(f"  Subject: {claim_email['subject']}")

    total_points = 0
    max_points = 9

    email_content = (
        (claim_email["subject"] or "") + " " + (claim_email["body"] or "")
    ).lower()

    # 1. Flight number
    if flight["flight_number"].lower() in email_content:
        print(f"  ✓ Contains flight number: {flight['flight_number']}")
        total_points += 1
    else:
        print(f"  ✗ Missing flight number: {flight['flight_number']}")

    # 2. Departure time — mock stores ISO TEXT; check both YYYY-MM-DD and "Month DD, YYYY"
    dep_iso = flight["departure_time"] or ""
    dep_date = dep_iso[:10]  # YYYY-MM-DD
    dep_month_day_year = ""
    try:
        from datetime import datetime as _dt

        # tolerate trailing 'Z' as +00:00 (Bun ISO)
        _parsed = _dt.fromisoformat(dep_iso.replace("Z", "+00:00"))
        dep_month_day_year = _parsed.strftime("%B %d, %Y").lower()
    except (TypeError, ValueError):
        pass
    if (dep_date and dep_date in email_content) or (
        dep_month_day_year and dep_month_day_year in email_content
    ):
        print(f"  ✓ Contains departure time: {dep_date}")
        total_points += 1
    else:
        print("  ✗ Missing departure time")

    # 3. Departure city
    if flight["origin_city"].lower() in email_content:
        print(f"  ✓ Contains departure city: {flight['origin_city']}")
        total_points += 1
    else:
        print(f"  ✗ Missing departure city: {flight['origin_city']}")

    # 4. Arrival city
    if flight["destination_city"].lower() in email_content:
        print(f"  ✓ Contains arrival city: {flight['destination_city']}")
        total_points += 1
    else:
        print(f"  ✗ Missing arrival city: {flight['destination_city']}")

    # 5. Booking reference
    if booking["booking_reference"].lower() in email_content:
        print(f"  ✓ Contains booking reference: {booking['booking_reference']}")
        total_points += 1
    else:
        print(f"  ✗ Missing booking reference: {booking['booking_reference']}")

    # 6. Name (Peter Griffin)
    if "peter griffin" in email_content:
        print("  ✓ Contains name: Peter Griffin")
        total_points += 1
    else:
        print("  ✗ Missing name: Peter Griffin")

    # 7. Email address
    if (peter["email"] or "").lower() in email_content:
        print(f"  ✓ Contains email: {peter['email']}")
        total_points += 1
    else:
        print(f"  ✗ Missing email: {peter['email']}")

    # 8. Phone number
    if peter["phone"] and peter["phone"] in email_content:
        print(f"  ✓ Contains phone: {peter['phone']}")
        total_points += 1
    else:
        print(f"  ✗ Missing phone: {peter['phone']}")

    # 9. Image attachment
    if attachment_count > 0:
        print(f"  ✓ Contains attachment(s) ({attachment_count})")
        total_points += 1
    else:
        print("  ✗ Missing attachment")

    score = total_points / max_points
    print(f"\nTotal points: {total_points}/{max_points}")
    print(f"Normalized score: {score:.2f}")
    return score


score = check()
print(f"Score: {score}/1.0")
sys.exit(0 if score >= 1.0 else 1)
