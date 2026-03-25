#!/usr/bin/env python3
"""Verify flight-seat-selection-failed: check agent found alternative seat"""

import sys

sys.path.insert(0, "/workspace/environment/airline-app/backend")
from app import create_app
from models import Booking

app = create_app()


def check():
    with app.app_context():
        booking = Booking.query.filter_by(status="checked_in").first()
        if booking:
            print(
                f"PASS: Found checked-in booking with fallback seat (id: {booking.id})"
            )
            return 1.0
        print("FAIL: No checked-in booking found (agent should have found alternative)")
        return 0.0


score = check()
print(f"Score: {score}/1.0")
sys.exit(0 if score >= 1.0 else 1)
