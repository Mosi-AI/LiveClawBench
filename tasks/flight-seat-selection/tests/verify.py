#!/usr/bin/env python3
"""Verify flight-seat-selection task: check if seat selected and checked in.

PR-6 / B6.2 ③ — verifier-backend alignment
==========================================

PR-3 (commit ``3bd33dbd``) moved this task's airline backend to the Bun
``mock-airline`` binary at ``/var/lib/mock-data/airline/airline.db``.
The Flask DB was no longer the source of truth, so seat assignments the
agent made via the UI lived in the mock DB and this verifier saw
nothing. Rewrite to query the mock DB directly via stdlib sqlite3.

Scoring (unchanged):
  * 0.4  seat selected on flight GKD2001
  * 0.3  window seat (letter A or F)
  * 0.3  checked in
  Total cap 1.0.
"""

import sqlite3
import sys

AIRLINE_DB_PATH = "/var/lib/mock-data/airline/airline.db"
PETER_EMAIL = "peter.griffin@work.mosi.inc"
TARGET_FLIGHT_NUMBER = "GKD2001"


def check() -> float:
    try:
        conn = sqlite3.connect(f"file:{AIRLINE_DB_PATH}?mode=ro", uri=True)
    except sqlite3.OperationalError as exc:
        print(f"FAIL: mock-airline DB not reachable at {AIRLINE_DB_PATH}: {exc}")
        return 0.0
    conn.row_factory = sqlite3.Row
    try:
        peter = conn.execute(
            "SELECT id FROM users WHERE email = ?", (PETER_EMAIL,)
        ).fetchone()
        if peter is None:
            print(f"FAIL: Peter Griffin user not found (email={PETER_EMAIL})")
            return 0.0

        flight = conn.execute(
            "SELECT id, flight_number, departure_time FROM flights WHERE flight_number = ?",
            (TARGET_FLIGHT_NUMBER,),
        ).fetchone()
        if flight is None:
            print(f"FAIL: Flight {TARGET_FLIGHT_NUMBER} not found")
            return 0.0

        print(f"Found flight: {flight['flight_number']}")
        print(f"  Departure: {flight['departure_time']}")

        booking = conn.execute(
            "SELECT id, booking_reference, checked_in FROM bookings "
            "WHERE user_id = ? AND flight_id = ? LIMIT 1",
            (peter["id"], flight["id"]),
        ).fetchone()
        if booking is None:
            print(f"FAIL: No booking found for Peter on flight {TARGET_FLIGHT_NUMBER}")
            return 0.0

        print(f"Found booking: {booking['booking_reference']}")

        passenger = conn.execute(
            "SELECT seat_id FROM passengers WHERE booking_id = ? LIMIT 1",
            (booking["id"],),
        ).fetchone()
        if passenger is None:
            print("FAIL: No passenger found for booking")
            return 0.0

        seat = None
        if passenger["seat_id"]:
            seat = conn.execute(
                "SELECT seat_number FROM seats WHERE id = ?",
                (passenger["seat_id"],),
            ).fetchone()
    finally:
        conn.close()

    score = 0.0

    if seat is not None:
        seat_number = seat["seat_number"]
        print(f"  ✓ Seat selected: {seat_number}")
        score += 0.4

        seat_num_upper = (seat_number or "").upper()
        if "A" in seat_num_upper or "F" in seat_num_upper:
            print(f"  ✓ Window seat selected: {seat_number}")
            score += 0.3
        else:
            print(f"  ✗ Not a window seat: {seat_number}")
    elif passenger["seat_id"]:
        print("  ✗ Seat ID found but seat not found in database")
    else:
        print("  ✗ No seat selected")

    if booking["checked_in"]:
        print("  ✓ Checked in")
        score += 0.3
    else:
        print("  ✗ Not checked in")

    print(f"\nFinal score: {score:.2f}")
    return min(score, 1.0)


score = check()
print(f"Score: {score}/1.0")
sys.exit(0 if score >= 1.0 else 1)
