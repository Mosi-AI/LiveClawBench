#!/usr/bin/env python3
"""Test script to check for email with specific recipient_email"""

from app import app, db
from models import Email

def check_email_by_recipient(recipient_email):
    """
    Check if an email exists with the given recipient_email.

    Args:
        recipient_email: The recipient email address to search for

    Returns:
        True if found, False otherwise
    """
    with app.app_context():
        email = Email.query.filter_by(recipient_email=recipient_email).first()

        if email:
            print(f"✓ Found email record with recipient_email: {recipient_email}")
            print(f"  Email ID: {email.id}")
            print(f"  Subject: {email.subject}")
            print(f"  Sender ID: {email.sender_id}")
            print(f"  Folder: {email.folder}")
            print(f"  Created at: {email.created_at}")
            return True
        else:
            print(f"✗ No email record found with recipient_email: {recipient_email}")
            return False

if __name__ == '__main__':
    target_email = 'mary.lee@work.mosi.inc'
    check_email_by_recipient(target_email)
