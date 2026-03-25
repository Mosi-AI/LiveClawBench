#!/usr/bin/env python3
"""Verify schedule-change-request task: check if emails sent to all contacts"""

import sys

sys.path.insert(0, "/workspace/environment/email-app/backend")
from app import app
from models import Email


def check():
    with app.app_context():
        # Required recipient emails
        required_emails = [
            "marytheshot@gmail.com",
            "jason.wang97@mail.ucsd.edu",
            "karre8523@outlook.com",
            "gaeuala@outlook.com",
        ]

        total_points = 0
        max_points = len(required_emails)

        print("Checking sent emails to required contacts:\n")

        for email_addr in required_emails:
            email = Email.query.filter_by(
                recipient_email=email_addr, folder="sent"
            ).first()

            if email:
                print(f"  ✓ Email sent to: {email_addr}")
                print(f"    Subject: {email.subject}")
                total_points += 1
            else:
                print(f"  ✗ No email sent to: {email_addr}")

        # Normalize score
        score = total_points / max_points if max_points > 0 else 0.0

        print(f"\nTotal points: {total_points}/{max_points}")
        print(f"Normalized score: {score:.2f}")

        return score


score = check()
print(f"Score: {score}/1.0")
sys.exit(0 if score >= 1.0 else 1)
