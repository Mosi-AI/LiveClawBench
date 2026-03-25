#!/usr/bin/env python3
"""Verify flight-booking task: check if flight booked correctly"""

import sys

sys.path.insert(0, "/workspace/environment/airline-app/backend")
from datetime import datetime, timedelta

from app import create_app
from app.models.booking import Booking
from app.models.user import User


def check():
    app = create_app("development")

    with app.app_context():
        # Get Peter Griffin
        peter = User.query.filter_by(email="peter.griffin@work.mosi.inc").first()
        if not peter:
            print("FAIL: Peter Griffin user not found")
            return 0.0

        # Calculate next Monday
        today = datetime.now()
        days_until_next_monday = (7 - today.weekday()) % 7
        if days_until_next_monday == 0:
            days_until_next_monday = 7
        next_monday = today + timedelta(days=days_until_next_monday)
        next_monday_date = next_monday.date()

        # Find booking for Peter on next Monday
        bookings = Booking.query.filter_by(user_id=peter.id).all()

        target_booking = None
        for booking in bookings:
            if (
                booking.flight
                and booking.flight.departure_time.date() == next_monday_date
            ):
                # Check if it's JFK to LAX
                if (
                    booking.flight.origin_code == "JFK"
                    and booking.flight.destination_code == "LAX"
                ):
                    target_booking = booking
                    break

        if not target_booking:
            print(
                "FAIL: No booking found for Peter Griffin on next Monday from JFK to LAX"
            )
            return 0.0

        print(f"Found booking: {target_booking.booking_reference}")
        flight = target_booking.flight
        print(
            f"  Flight: {flight.flight_number} ({flight.origin_code} -> {flight.destination_code})"
        )
        print(f"  Departure: {flight.departure_time}")
        print(f"  Cabin class: {target_booking.cabin_class}")

        # Check if cabin class is economy
        if target_booking.cabin_class != "economy":
            print("FAIL: Cabin class is not economy")
            return 0.0

        # Base score for correct booking
        score = 0.8

        # Bonus 0.2 points for 10:00 AM departure
        departure_hour = flight.departure_time.hour
        departure_minute = flight.departure_time.minute

        if departure_hour == 10 and departure_minute == 0:
            print("  ✓ Flight departs at 10:00 AM (optimal time)")
            score += 0.2
        else:
            print(
                f"  Flight departs at {departure_hour:02d}:{departure_minute:02d} (not 10:00 AM)"
            )

        print(f"\nFinal score: {score:.2f}")
        return min(score, 1.0)


score = check()
print(f"Score: {score}/1.0")
sys.exit(0 if score >= 1.0 else 1)
