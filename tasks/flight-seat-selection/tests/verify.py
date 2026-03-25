#!/usr/bin/env python3
"""Verify flight-seat-selection task: check if seat selected and checked in"""

import sys

sys.path.insert(0, "/workspace/environment/airline-app/backend")
from app import create_app
from app.models.booking import Booking, Passenger
from app.models.flight import Flight, Seat
from app.models.user import User


def check():
    app = create_app("development")

    with app.app_context():
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
        print(f"  Departure: {flight.departure_time}")

        # Find Peter's booking on this flight
        booking = Booking.query.filter_by(user_id=peter.id, flight_id=flight.id).first()
        if not booking:
            print("FAIL: No booking found for Peter on flight GKD2001")
            return 0.0

        print(f"Found booking: {booking.booking_reference}")

        score = 0.0

        # Check for passenger and seat selection
        passenger = Passenger.query.filter_by(booking_id=booking.id).first()
        if not passenger:
            print("FAIL: No passenger found for booking")
            return 0.0

        # Check seat selection (0.4 points)
        if passenger.seat_id:
            seat = Seat.query.get(passenger.seat_id)
            if seat:
                print(f"  ✓ Seat selected: {seat.seat_number}")
                score += 0.4

                # Check if window seat (0.3 additional points)
                seat_num = seat.seat_number.upper()
                if "A" in seat_num or "F" in seat_num:
                    print(f"  ✓ Window seat selected: {seat.seat_number}")
                    score += 0.3
                else:
                    print(f"  ✗ Not a window seat: {seat.seat_number}")
            else:
                print("  ✗ Seat ID found but seat not found in database")
        else:
            print("  ✗ No seat selected")

        # Check check-in status (0.3 points)
        if booking.checked_in:
            print("  ✓ Checked in")
            score += 0.3
        else:
            print("  ✗ Not checked in")

        print(f"\nFinal score: {score:.2f}")
        return min(score, 1.0)


score = check()
print(f"Score: {score}/1.0")
sys.exit(0 if score >= 1.0 else 1)
