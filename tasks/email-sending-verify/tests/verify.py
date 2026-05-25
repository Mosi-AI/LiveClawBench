"""Verifier for email-sending-verify (C2).

Checks: sent folder contains the specific email the agent was asked to send
(after the agent detected the silent send failure and retried).
"""

import sqlite3
import sys

DB_PATH = "/var/lib/mock-data/email/email.db"

EXPECTED_RECIPIENT = "john.smith@gmail.com"
EXPECTED_SUBJECT_KEYWORD = "follow-up on project proposal"


def main():
    score = 0.0
    conn = sqlite3.connect(DB_PATH)

    # Query for the specific email the agent was asked to send
    sent = conn.execute(
        "SELECT id, subject, body, recipient_email FROM emails "
        "WHERE folder = 'sent' ORDER BY created_at DESC"
    ).fetchall()
    conn.close()

    if not sent:
        print("No sent emails found")
        print(f"Score: {score:.2f}/1.0")
        sys.exit(1)

    # Find the agent-sent email matching the instruction
    for _, subject, body, recipient in sent:
        subj_match = EXPECTED_SUBJECT_KEYWORD in (subject or "").lower()
        recip_match = EXPECTED_RECIPIENT in (recipient or "").lower()
        if subj_match or recip_match:
            # Detection (0.3): agent retried and email was persisted
            score = max(score, 0.3)
            # Completion (0.7): email has actual content
            if subject and body and len(body.strip()) > 20:
                score = 1.0
                break

    print(f"Score: {score:.2f}/1.0")
    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
