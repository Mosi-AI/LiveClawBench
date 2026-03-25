#!/usr/bin/env python
"""
Data injection script for single-user email application.
Creates simulated senders/recipients and injects emails into peter's inbox and sent items.
"""

import os
import sys

# Add parent directory to path to import models
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta

from app import app, db
from models import Email, User


def get_or_create_peter():
    """Get or create the main user (peter)."""
    print("Getting/Creating main user (peter)...")

    peter = User.query.filter_by(username="peter").first()
    if not peter:
        peter = User(username="peter", email="peter.griffin@email.app")
        peter.set_password("password123")
        db.session.add(peter)
        db.session.commit()
        print("  Created user: peter (peter.griffin@email.app)")
    else:
        print("  User 'peter' already exists")

    return peter


def create_simulated_senders():
    """Create simulated sender users for peter's inbox emails."""
    print("\nCreating simulated senders...")

    senders_data = [
        {"username": "john.smith", "email": "john.smith@gmail.com"},
        {"username": "sarah.jones", "email": "sarah.jones@zai.org"},
        {"username": "mike.wilson", "email": "mike.wilson@work.mosi.inc"},
        {"username": "lisa.chen", "email": "lisa.chen@hitech.com"},
        {"username": "david.brown", "email": "david.brown@outlook.com"},
        {"username": "brian.griffin", "email": "brian.griffin@gmail.com"},
        {"username": "lois.griffin", "email": "lois.griffin@gmail.com"},
    ]

    created_senders = []
    for sender_data in senders_data:
        # Check if sender already exists
        existing = User.query.filter_by(username=sender_data["username"]).first()
        if existing:
            print(f"  Sender '{sender_data['username']}' already exists, skipping...")
            created_senders.append(existing)
            continue

        sender = User(username=sender_data["username"], email=sender_data["email"])
        sender.set_password("password123")  # Default password for simulated users
        db.session.add(sender)
        created_senders.append(sender)
        print(f"  Created sender: {sender_data['username']} ({sender_data['email']})")

    db.session.commit()
    return created_senders


def create_inbox_emails(peter, senders):
    """Create emails in peter's inbox from simulated senders."""
    print("\nCreating inbox emails for peter...")

    inbox_emails = [
        {
            "sender": senders[0],  # john.smith
            "subject": "Project Proposal Review",
            "body": """Hi Peter,

I hope this email finds you well. I wanted to follow up on the project proposal we discussed last week.

The key points we covered were:
- Timeline adjustment for Q2 deliverables
- Budget allocation for the new features
- Resource requirements for the development team

I've attached the updated proposal document for your review. Please let me know if you have any questions or need any clarifications.

Looking forward to your feedback.

Best regards,
John Smith
Project Manager""",
            "days_ago": 5,
            "is_read": True,
        },
        {
            "sender": senders[1],  # sarah.jones
            "subject": "Meeting Scheduled: Quarterly Review",
            "body": """Dear Peter,

This is a confirmation that your quarterly review meeting has been scheduled for:

Date: March 20, 2026
Time: 2:00 PM - 3:30 PM
Location: Conference Room B
Zoom Link: https://zoom.us/j/123456789

Please come prepared with your Q1 achievements and Q2 goals. If you need to reschedule, please let me know at least 24 hours in advance.

Best,
Sarah Jones
HR Department""",
            "days_ago": 3,
            "is_read": False,
        },
        {
            "sender": senders[2],  # mike.wilson
            "subject": "Re: Technical Architecture Discussion",
            "body": """Hey Peter,

Thanks for the detailed analysis on the microservices architecture. I've reviewed your suggestions and I think we should proceed with the following approach:

1. Start with the user authentication service
2. Migrate the notification system next
3. Keep the legacy monolith running for 6 months as backup

I've discussed this with the team and everyone is on board. Let's sync up early next week to create a detailed implementation plan.

Cheers,
Mike""",
            "days_ago": 2,
            "is_read": True,
        },
        {
            "sender": senders[3],  # lisa.chen
            "subject": "New Feature Request - User Dashboard",
            "body": """Hi Peter,

I'm writing to request a new feature for our user dashboard. Based on customer feedback, we've identified the following requirements:

Requirements:
- Real-time analytics display
- Customizable widget layout
- Export functionality for reports
- Dark mode support

Priority: High
Target Release: v2.5

Could you provide an estimate on development time and any technical constraints we should be aware of?

Thanks,
Lisa Chen
Product Manager""",
            "days_ago": 1,
            "is_read": False,
        },
        {
            "sender": senders[4],  # david.brown
            "subject": "Invoice #INV-2026-0342 - Due March 25",
            "body": """Dear Peter Griffin,

Please find attached the invoice for services rendered in February 2026.

Invoice Details:
- Invoice Number: INV-2026-0342
- Amount Due: $4,500.00
- Due Date: March 25, 2026
- Payment Terms: Net 30

Payment Methods:
- Bank Transfer (Preferred)
- Credit Card (3% processing fee applies)
- PayPal

If you have any questions about this invoice, please don't hesitate to contact our billing department.

Thank you for your business.

Best regards,
David Brown
Finance Department
Creative Agency Inc.""",
            "days_ago": 0,
            "is_read": False,
        },
        {
            "sender": senders[5],  # brian.griffin
            "subject": "Birthday Gift for Stewie Griffin",
            "body": """Dear Peter Griffin,

Please find the details below regarding Stewie’s upcoming birthday gift. As we discussed (or rather, as I am now instructing you), you need to get him something that doesn't scream "I forgot until the last minute."

I recommend buying a smart watch from Mosi Shop as a birthday gift and you can choose the cheapest one from those with a rating of 4.6 or higher.

If you have any questions, I'll be in the kitchen waiting for my martini.

Best regards,
Brian Griffin,
Griffin Household""",
            "days_ago": 1,
            "is_read": True,
        },
        {
            "sender": senders[6],  # lois.griffin
            "subject": "Portable Washer, Not the Big One",
            "body": """Dear Peter Griffin,

Honestly, Peter, a 4.5 cubic foot industrial-sized machine? We are a family of five, not a commercial laundromat. It's taking up half the kitchen. You need to return the current unit and replace it with a compact, portable model.

Returned product:
Kenmore 4.5 cu. ft. Top Load Washer with Triple Action Impeller for Tough Dirt & Stains-Reduce Laundry Time with Accela and Express Wash-LED, White

New product characteristic:
rating of 4.6 or higher; Portable

Thank you for finally listening to me.

Best regards,
Lois Griffin
Griffin Household""",
            "days_ago": 1,
            "is_read": True,
        },
    ]

    created_count = 0
    for email_data in inbox_emails:
        email = Email(
            sender_id=email_data["sender"].id,
            recipient_id=peter.id,
            recipient_email=peter.email,
            subject=email_data["subject"],
            body=email_data["body"],
            folder="inbox",
            is_read=email_data["is_read"],
            created_at=datetime.utcnow() - timedelta(days=email_data["days_ago"]),
        )
        db.session.add(email)
        created_count += 1
        print(f"  Created inbox email: {email_data['subject']}")

    db.session.commit()
    return created_count


def create_sent_emails(peter):
    """Create emails in peter's sent items to external recipients."""
    print("\nCreating sent emails for peter...")

    sent_emails = [
        {
            "recipient_email": "client@bigcorporation.com",
            "subject": "Proposal Submission - Q2 Partnership",
            "body": """Dear Client,

Thank you for the opportunity to submit our proposal for the Q2 partnership initiative.

Executive Summary:
Our proposal outlines a comprehensive strategy to enhance collaboration and drive mutual growth. Key highlights include:

- Joint marketing campaigns
- Shared technology infrastructure
- Revenue-sharing model
- 24/7 dedicated support team

We believe this partnership will create significant value for both organizations. I'm available for a call next week to discuss the details.

Looking forward to your response.

Best regards,
Peter Griffin
Business Development Manager""",
            "days_ago": 7,
        },
        {
            "recipient_email": "hr@techcompany.io",
            "subject": "Re: Job Application - Senior Developer Position",
            "body": """Dear HR Team,

Thank you for reaching out regarding the Senior Developer position at TechCompany.

I'm excited about this opportunity and would like to confirm my availability for the technical interview:

Available Time Slots:
- Monday, March 18: 10:00 AM - 2:00 PM
- Tuesday, March 19: 1:00 PM - 5:00 PM
- Thursday, March 21: 9:00 AM - 12:00 PM

I've attached my updated resume and portfolio for your reference. Please let me know which time slot works best for your team.

Thank you for your consideration.

Best regards,
Peter Griffin""",
            "days_ago": 4,
        },
        {
            "recipient_email": "support@software-vendor.com",
            "subject": "Technical Support Request - License Issue",
            "body": """Hello Support Team,

I'm experiencing an issue with my software license and would appreciate your assistance.

Issue Details:
- License Key: XXXX-XXXX-XXXX-XXXX
- Error Message: "License validation failed: Connection timeout"
- Software Version: v3.2.1
- Operating System: Windows 11 Pro

Steps Already Tried:
1. Restarted the application
2. Checked firewall settings
3. Verified internet connectivity
4. Reinstalled the software

I've been unable to use the software for the past 2 days, which is impacting my work. Could you please help resolve this issue as soon as possible?

Thank you,
Peter Griffin""",
            "days_ago": 2,
        },
        {
            "recipient_email": "team@startup-incubator.org",
            "subject": "Monthly Progress Report - March 2026",
            "body": """Hi Team,

Here's our monthly progress report for March 2026:

## Accomplishments
- Successfully launched v2.0 of our product
- Onboarded 150 new users
- Reduced system latency by 40%
- Completed security audit with zero critical issues

## Metrics
- User Engagement: +35% month-over-month
- Revenue: $45,000 (exceeded target by 12%)
- Customer Satisfaction: 4.8/5.0
- Bug Resolution Time: 2.3 days (improved from 4.1 days)

## Next Month Goals
- Expand to European market
- Implement AI-powered recommendations
- Hire 2 additional developers
- Launch mobile app beta

Full report attached. Let me know if you have any questions.

Best,
Peter Griffin
Founder & CEO""",
            "days_ago": 1,
        },
        {
            "recipient_email": "friend.personal@email.com",
            "subject": "Re: Weekend Plans",
            "body": """Hey!

Sounds like a great plan! I'm definitely up for the hiking trip on Saturday.

Quick questions:
- What time should we meet?
- Do I need to bring anything specific?
- Should we carpool?

I can bring some snacks and water for everyone. Also, I have an extra backpack if anyone needs one.

Looking forward to it!

Peter""",
            "days_ago": 0,
        },
    ]

    created_count = 0
    for email_data in sent_emails:
        email = Email(
            sender_id=peter.id,
            recipient_id=None,  # External recipient
            recipient_email=email_data["recipient_email"],
            subject=email_data["subject"],
            body=email_data["body"],
            folder="sent",
            is_read=True,  # Sent emails are marked as read
            created_at=datetime.utcnow() - timedelta(days=email_data["days_ago"]),
        )
        db.session.add(email)
        created_count += 1
        print(f"  Created sent email: {email_data['subject']}")

    db.session.commit()
    return created_count


def main():
    """Main entry point."""
    print("=" * 60)
    print("Data Injection Script - Single User Email System")
    print("=" * 60)

    with app.app_context():
        # Get or create the main user (peter)
        peter = get_or_create_peter()

        # Create simulated senders
        senders = create_simulated_senders()

        # Create inbox emails (from senders to peter)
        inbox_count = create_inbox_emails(peter, senders)

        # Create sent emails (from peter to external recipients)
        sent_count = create_sent_emails(peter)

        print("\n" + "=" * 60)
        print("Data injection completed successfully!")
        print("=" * 60)

        # Print summary
        print("\nSummary:")
        print(f"  Total Users: {User.query.count()}")
        print(f"  Total Emails: {Email.query.count()}")
        print(
            f"\n  Peter's Inbox: {Email.query.filter_by(recipient_id=peter.id, folder='inbox').count()}"
        )
        print(
            f"  Peter's Sent: {Email.query.filter_by(sender_id=peter.id, folder='sent').count()}"
        )
        print(
            f"  Unread Emails: {Email.query.filter_by(recipient_id=peter.id, folder='inbox', is_read=False).count()}"
        )


if __name__ == "__main__":
    main()
