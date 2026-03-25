#!/usr/bin/env python3
"""Verify flight-info-change-notice: check notification emails sent to travelers"""

import sys

sys.path.insert(0, "/workspace/environment/email-app/backend")
from app import app
from models import Email

TARGET_EMAILS = [
    "marytheshot@gmail.com",
    "jason.wang97@mail.ucsd.edu",
    "karre8523@outlook.com",
    "gaeuala@outlook.com",
]


def check():
    score = 0.0
    with app.app_context():
        for target in TARGET_EMAILS:
            email = Email.query.filter_by(recipient_email=target).first()
            if email:
                print(f"PASS: Found email to {target}")
                score += 1.0
            else:
                print(f"FAIL: No email to {target}")
    return score


score = check()
total = len(TARGET_EMAILS)
print(f"Score: {score}/{total}")
sys.exit(0 if score >= total else 1)
