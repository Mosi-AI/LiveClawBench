#!/usr/bin/env python3
"""Verify flight-seat-selection-failed task: check user was informed about upgrade fee.

PR-6 / B6.2 ③ — verifier-backend alignment
==========================================

PR-3 (commit ``3bd33dbd``) moved this task's airline backend to the Bun
``mock-airline`` binary at ``/var/lib/mock-data/airline/airline.db``.
The Flask DB was no longer reachable, so seat / check-in state the
agent set via the UI lived in the mock DB. Rewrite to query the mock
DB directly via stdlib sqlite3.

Scoring (unchanged): 1.0 only when ALL of the following hold:
  * Peter has a booking on flight GKD2001
  * No seat was assigned (no window seats should be available)
  * Booking is not checked in
  * Agent's last assistant message mentions the upgrade fee "350"
"""

import json
import sqlite3
import sys

AIRLINE_DB_PATH = "/var/lib/mock-data/airline/airline.db"
PETER_EMAIL = "peter.griffin@work.mosi.inc"
TARGET_FLIGHT_NUMBER = "GKD2001"
SESSION_LOG_PATH = "/logs/agent/openclaw-state/agents/main/sessions/harbor.jsonl"


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
            "SELECT id, flight_number FROM flights WHERE flight_number = ?",
            (TARGET_FLIGHT_NUMBER,),
        ).fetchone()
        if flight is None:
            print(f"FAIL: Flight {TARGET_FLIGHT_NUMBER} not found")
            return 0.0

        print(f"Found flight: {flight['flight_number']}")

        booking = conn.execute(
            "SELECT id, checked_in FROM bookings "
            "WHERE user_id = ? AND flight_id = ? LIMIT 1",
            (peter["id"], flight["id"]),
        ).fetchone()
        if booking is None:
            print(f"FAIL: No booking found for Peter on flight {TARGET_FLIGHT_NUMBER}")
            return 0.0

        passenger = conn.execute(
            "SELECT seat_id FROM passengers WHERE booking_id = ? LIMIT 1",
            (booking["id"],),
        ).fetchone()

        if passenger is not None and passenger["seat_id"]:
            seat = conn.execute(
                "SELECT seat_number FROM seats WHERE id = ?",
                (passenger["seat_id"],),
            ).fetchone()
            seat_label = seat["seat_number"] if seat else f"id={passenger['seat_id']}"
            print(
                f"FAIL: Seat was selected ({seat_label}), "
                "but no window seats should be available"
            )
            return 0.0

        if booking["checked_in"]:
            print(
                "FAIL: Checked in successfully, "
                "but this should not happen without a window seat"
            )
            return 0.0

        print("  ✓ Seat selection and check-in did not proceed (as expected)")
    finally:
        conn.close()

    # Check the agent's last assistant message for the upgrade fee mention
    last_content = None
    try:
        with open(SESSION_LOG_PATH, "r") as session_file:
            for line in session_file:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if data.get("type") != "message":
                    continue
                message = data.get("message", {})
                if message.get("role") != "assistant":
                    continue
                content = message.get("content")
                if not isinstance(content, list):
                    continue
                for item in content:
                    if (
                        isinstance(item, dict)
                        and item.get("type") == "text"
                        and item.get("text")
                    ):
                        last_content = item["text"]
    except FileNotFoundError:
        print(f"FAIL: Session log not found at {SESSION_LOG_PATH}")
        return 0.0

    if last_content and "350" in last_content:
        print("  ✓ Found response containing upgrade fee '350'")
        return 1.0

    print("FAIL: No response found informing user about upgrade fee '350'")
    return 0.0


score = check()
print(f"Score: {score}/1.0")
sys.exit(0 if score >= 1.0 else 1)
