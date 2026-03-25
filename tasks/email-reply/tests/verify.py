#!/usr/bin/env python3
"""Verify email-reply task: check reply sent to lau@coop-division.parrot-ai.org"""

import sys

sys.path.insert(0, "/workspace/environment/email-app/backend")
from app import app
from models import Email


def check():
    with app.app_context():
        # email = Email.query.filter_by(recipient_email="lau@coop-division.parrot-ai.org").first()
        email = Email.query.filter_by(
            recipient_email="lau@coop-division.parrot-ai.org", folder="sent"
        ).first()
        if email:
            print(
                f"PASS: Found reply to lau@coop-division.parrot-ai.org (subject: {email.subject})"
            )
            return 1.0
        print("FAIL: No reply found to lau@coop-division.parrot-ai.org")
        return 0.0


score = check()
print(f"Score: {score}/1.0")
sys.exit(0 if score >= 1.0 else 1)
