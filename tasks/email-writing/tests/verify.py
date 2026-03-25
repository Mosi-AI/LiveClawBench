#!/usr/bin/env python3
"""Verify email-writing task: check email sent to mary.lee@work.mosi.inc"""
import sys
sys.path.insert(0, "/workspace/environment/email-app/backend")
from app import app, db
from models import Email

def check():
    with app.app_context():
        email = Email.query.filter_by(recipient_email="mary.lee@work.mosi.inc").first()
        if email:
            print(f"PASS: Found email to mary.lee@work.mosi.inc (subject: {email.subject})")
            return 1.0
        print("FAIL: No email found to mary.lee@work.mosi.inc")
        return 0.0

score = check()
print(f"Score: {score}/1.0")
sys.exit(0 if score >= 1.0 else 1)
