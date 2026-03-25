#!/usr/bin/env python3
"""Verify flight-cancel-claim task: check if claim email sent correctly"""

import sys

sys.path.insert(0, "/workspace/environment/airline-app/backend")
sys.path.insert(0, "/workspace/environment/email-app/backend")
from app import create_app
from app.models.booking import Booking
from app.models.flight import Flight
from app.models.user import User
from models import Email


def check():
    airline_app = create_app("development")

    with airline_app.app_context():
        # Get Peter Griffin and his cancelled flight booking
        peter = User.query.filter_by(email="peter.griffin@work.mosi.inc").first()
        if not peter:
            print("FAIL: Peter Griffin user not found")
            return 0.0

        # Find the cancelled flight GKD2001
        flight = Flight.query.filter_by(flight_number="GKD2001").first()
        if not flight:
            print("FAIL: Flight GKD2001 not found")
            return 0.0

        # Find Peter's booking on this flight
        booking = Booking.query.filter_by(user_id=peter.id, flight_id=flight.id).first()
        if not booking:
            print("FAIL: No booking found for Peter on flight GKD2001")
            return 0.0

        print(f"Found cancelled flight: {flight.flight_number}")
        print(f"  Route: {flight.origin_city} -> {flight.destination_city}")
        print(f"  Departure: {flight.departure_time}")
        print(f"  Booking ref: {booking.booking_reference}")

        # Now check the email
        from app import app as email_app

        with email_app.app_context():
            claim_email = Email.query.filter_by(
                recipient_email="claims@gkdairlines.com", folder="sent"
            ).first()

            if not claim_email:
                print("FAIL: No email sent to claims@gkdairlines.com")
                return 0.0

            print(f"\nFound claim email (ID: {claim_email.id})")
            print(f"  Subject: {claim_email.subject}")

            total_points = 0
            max_points = 9

            # Check email content for required information
            email_content = (claim_email.subject + " " + claim_email.body).lower()

            # 1. Flight number
            if flight.flight_number.lower() in email_content:
                print(f"  ✓ Contains flight number: {flight.flight_number}")
                total_points += 1
            else:
                print(f"  ✗ Missing flight number: {flight.flight_number}")

            # 2. Departure time
            dep_time_str = flight.departure_time.strftime("%Y-%m-%d")
            if (
                dep_time_str in email_content
                or flight.departure_time.strftime("%B %d, %Y").lower() in email_content
            ):
                print(f"  ✓ Contains departure time: {dep_time_str}")
                total_points += 1
            else:
                print("  ✗ Missing departure time")

            # 3. Departure city
            if flight.origin_city.lower() in email_content:
                print(f"  ✓ Contains departure city: {flight.origin_city}")
                total_points += 1
            else:
                print(f"  ✗ Missing departure city: {flight.origin_city}")

            # 4. Arrival city
            if flight.destination_city.lower() in email_content:
                print(f"  ✓ Contains arrival city: {flight.destination_city}")
                total_points += 1
            else:
                print(f"  ✗ Missing arrival city: {flight.destination_city}")

            # 5. Booking reference
            if booking.booking_reference.lower() in email_content:
                print(f"  ✓ Contains booking reference: {booking.booking_reference}")
                total_points += 1
            else:
                print(f"  ✗ Missing booking reference: {booking.booking_reference}")

            # 6. Name (Peter Griffin)
            if "peter griffin" in email_content:
                print("  ✓ Contains name: Peter Griffin")
                total_points += 1
            else:
                print("  ✗ Missing name: Peter Griffin")

            # 7. Email address
            if peter.email.lower() in email_content:
                print(f"  ✓ Contains email: {peter.email}")
                total_points += 1
            else:
                print(f"  ✗ Missing email: {peter.email}")

            # 8. Phone number
            if peter.phone and peter.phone in email_content:
                print(f"  ✓ Contains phone: {peter.phone}")
                total_points += 1
            else:
                print(f"  ✗ Missing phone: {peter.phone}")

            # 9. Image attachment
            if claim_email.attachments and len(claim_email.attachments) > 0:
                print("  ✓ Contains attachment(s)")
                total_points += 1
            else:
                print("  ✗ Missing attachment")

            # Normalize score
            score = total_points / max_points

            print(f"\nTotal points: {total_points}/{max_points}")
            print(f"Normalized score: {score:.2f}")

            return score


score = check()
print(f"Score: {score}/1.0")
sys.exit(0 if score >= 1.0 else 1)
