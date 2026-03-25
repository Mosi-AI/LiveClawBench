#!/usr/bin/env python3
"""Verify flight-seat-selection-failed task: check if user informed about upgrade fee"""

import sys

sys.path.insert(0, "/workspace/environment/airline-app/backend")
sys.path.insert(0, "/workspace/environment/email-app/backend")
import json

from app import create_app
from app.models.booking import Booking, Passenger
from app.models.flight import Flight, Seat
from app.models.user import User


def check():
    airline_app = create_app("development")

    with airline_app.app_context():
        # Get Peter Griffin
        peter = User.query.filter_by(email="peter.griffin@work.mosi.inc").first()
        if not peter:
            print("FAIL: Peter Griffin user not found")
            return 0.0

        # Find flight GKD2001
        flight = Flight.query.filter_by(flight_number="GKD2001").first()
        if not flight:
            print("FAIL: Flight GKD2001 not found")
            return 0.0

        print(f"Found flight: {flight.flight_number}")

        # Find Peter's booking
        booking = Booking.query.filter_by(user_id=peter.id, flight_id=flight.id).first()
        if not booking:
            print("FAIL: No booking found for Peter on flight GKD2001")
            return 0.0

        # Check if seat selection or check-in was successful (should not happen)
        passenger = Passenger.query.filter_by(booking_id=booking.id).first()

        if passenger and passenger.seat_id:
            seat = Seat.query.get(passenger.seat_id)
            if seat:
                print(
                    f"FAIL: Seat was selected ({seat.seat_number}), but no window seats should be available"
                )
                return 0.0

        if booking.checked_in:
            print(
                "FAIL: Checked in successfully, but this should not happen without a window seat"
            )
            return 0.0

        print("  ✓ Seat selection and check-in did not proceed (as expected)")

    # TODO: check the agent's feedback in message
    # export session's log
    SESSION_LOG_PATH = "/logs/agent/openclaw-state/agents/main/sessions/harbor.jsonl"
    last_content = None
    with open(SESSION_LOG_PATH, "r") as file:
        # find the last response

        for line in file:
            line = line.strip()
            if not line:
                continue

            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue

            if data.get("role") == "assistant":
                last_content = data.get("content")

        if "350" in last_content:
            print("  ✓ Found response containing upgrade fee '350'")
            return 1.0

    print("FAIL: No response found informing user about upgrade fee '350'")
    return 0.0


score = check()
print(f"Score: {score}/1.0")
sys.exit(0 if score >= 1.0 else 1)
