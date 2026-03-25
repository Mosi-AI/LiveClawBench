#!/usr/bin/env python3
"""Verify baggage-tracking-application task: check baggage report submitted correctly"""

import sys

sys.path.insert(0, "/workspace/environment/airline-app/backend")
from app import create_app
from app.models.baggage import BaggageTracking
from app.models.user import User


def check():
    app = create_app("development")

    with app.app_context():
        # Get Peter Griffin
        peter = User.query.filter_by(email="peter.griffin@work.mosi.inc").first()
        if not peter:
            print("FAIL: Peter Griffin user not found")
            return 0.0

        # Find baggage report for Peter
        report = (
            BaggageTracking.query.filter_by(user_id=peter.id)
            .order_by(BaggageTracking.created_at.desc())
            .first()
        )
        if not report:
            print("FAIL: No baggage report found for Peter Griffin")
            return 0.0

        print(f"Found baggage report for Peter Griffin (ID: {report.id})")

        total_points = 0
        max_points = 0

        # Check each field (excluding auto-generated fields like status, created_at, updated_at)
        # Required fields to check:
        fields_to_check = [
            ("flight_number", report.flight_number, "GKD888"),
            ("flight_time", report.flight_time, None),  # Just check if not None
            ("seat_number", report.seat_number, None),  # Just check if not None
            ("passenger_name", report.passenger_name, "Peter Griffin"),
            ("passenger_phone", report.passenger_phone, None),  # Just check if not None
            ("passenger_email", report.passenger_email, "peter.griffin@work.mosi.inc"),
            (
                "baggage_description",
                report.baggage_description,
                None,
            ),  # Check for keywords
            ("loss_details", report.loss_details, None),  # Just check if not None
        ]

        # Check standard fields
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

        # Check baggage_description for keywords
        desc = report.baggage_description.lower() if report.baggage_description else ""

        # Check for "20-inch"
        max_points += 1
        if "20-inch" in desc or "20 inch" in desc:
            print("  ✓ baggage_description contains '20-inch'")
            total_points += 1
        else:
            print("  ✗ baggage_description missing '20-inch'")

        # Check for "black"
        max_points += 1
        if "black" in desc:
            print("  ✓ baggage_description contains 'black'")
            total_points += 1
        else:
            print("  ✗ baggage_description missing 'black'")

        # Normalize score
        score = total_points / max_points if max_points > 0 else 0.0

        print(f"\nTotal points: {total_points}/{max_points}")
        print(f"Normalized score: {score:.2f}")

        return score


score = check()
print(f"Score: {score}/1.0")
sys.exit(0 if score >= 1.0 else 1)
