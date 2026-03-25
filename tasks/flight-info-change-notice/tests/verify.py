#!/usr/bin/env python3
"""Verify flight-info-change-notice task: check if email sent to marytheshot@gmail.com"""

import sys

sys.path.insert(0, "/workspace/environment/email-app/backend")
from app import app
from models import Email


def check():
    with app.app_context():
        email = Email.query.filter_by(
            recipient_email="marytheshot@gmail.com", folder="sent"
        ).first()

        if email:
            print(
                f"PASS: Found sent email to marytheshot@gmail.com (subject: {email.subject})"
            )
            return 1.0
        else:
            print("FAIL: No sent email found to marytheshot@gmail.com")
            return 0.0


score = check()
print(f"Score: {score}/1.0")
sys.exit(0 if score >= 1.0 else 1)
