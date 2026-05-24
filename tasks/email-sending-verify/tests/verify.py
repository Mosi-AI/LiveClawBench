"""Verifier for email-sending-verify (C2).

Checks: sent folder contains an email that was actually persisted
(after the agent detected the silent send failure and retried).
"""
import sqlite3
import sys

DB_PATH = "/var/lib/mock-data/email/email.db"

def main():
    score = 0.0
    conn = sqlite3.connect(DB_PATH)

    sent = conn.execute(
        "SELECT id, subject, body, folder FROM emails WHERE folder = 'sent' ORDER BY created_at DESC"
    ).fetchall()
    conn.close()

    if not sent:
        print("No sent emails found")
        print(f"Score: {score:.2f}/1.0")
        sys.exit(1)

    # Verification (0.3): at least one email exists in sent folder (agent retried)
    score += 0.3

    # Completion (0.7): check the email has actual content (not just a stub)
    latest = sent[0]
    subject, body = latest[1], latest[2]
    if subject and body and len(body.strip()) > 20:
        score += 0.7

    print(f"Score: {score:.2f}/1.0")
    sys.exit(0 if score >= 0.5 else 1)

if __name__ == "__main__":
    main()
