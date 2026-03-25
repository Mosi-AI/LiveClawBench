#!/usr/bin/env python3
"""Verify schedule-change-request: check emails sent and todos cleared"""

import sqlite3
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

EXPECTED_TODOS = [
    "Team Building",
    "Hiking with Friends",
    "Volunteer at Animal Shelter",
]


def check_emails():
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


def check_todos_cleared():
    db_path = "/workspace/environment/todolist-app/backend/instance/todolist.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    found = []
    missing = []
    for todo_title in EXPECTED_TODOS:
        cursor.execute(
            "SELECT id, title, completed FROM todo WHERE title LIKE ?",
            (f"%{todo_title}%",),
        )
        row = cursor.fetchone()
        if row:
            found.append(row)
        else:
            missing.append(todo_title)
    conn.close()
    return len(found) == 0, found, missing


email_score = check_emails()
all_cleared, found_todos, missing_todos = check_todos_cleared()
todo_score = float(len(missing_todos))
total_score = (email_score + todo_score) / 7.0

print(f"Email score: {email_score}/4.0")
print(f"Todo score: {todo_score}/3.0")
print(f"Total: {total_score:.2f}")
sys.exit(0 if total_score >= 0.8 else 1)
