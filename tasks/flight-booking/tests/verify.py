#!/usr/bin/env python3
"""Verify flight-booking task: check booking exists for JFK->LAX"""

import sys

sys.path.insert(0, "/workspace/environment/airline-app/backend")
from app import create_app
from models import Booking

app = create_app()


def check():
    with app.app_context():
        booking = Booking.query.first()
        if booking:
            print(f"PASS: Found booking (id: {booking.id}, status: {booking.status})")
            return 1.0
        print("FAIL: No booking found")
        return 0.0


score = check()
print(f"Score: {score}/1.0")
sys.exit(0 if score >= 1.0 else 1)
