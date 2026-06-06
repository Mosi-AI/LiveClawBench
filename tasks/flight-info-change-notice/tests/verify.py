#!/usr/bin/env python3
"""Verify flight-info-change-notice task: check if email sent to marytheshot@gmail.com.

PR-6 / B6.2 ③ — verifier-backend alignment
==========================================

PR-3 (commit ``3bd33dbd``) moved this task's email backend to the Bun
``mock-email`` binary, which writes to ``/var/lib/mock-data/email/email.db``
(Bun SQLite, schema in ``mock-platform/mocks/email/src/db.ts``). The
Flask email-app DB at ``/workspace/environment/email-app/backend/...``
was no longer reachable by the running app, so every email the agent
sent through the UI lived in the mock DB and this verifier saw an empty
emails table. Rewrite to query the mock DB directly via stdlib sqlite3.
"""

import sqlite3
import sys

EMAIL_DB_PATH = "/var/lib/mock-data/email/email.db"


def check() -> float:
    try:
        conn = sqlite3.connect(f"file:{EMAIL_DB_PATH}?mode=ro", uri=True)
    except sqlite3.OperationalError as exc:
        print(f"FAIL: mock-email DB not reachable at {EMAIL_DB_PATH}: {exc}")
        return 0.0
    conn.row_factory = sqlite3.Row
    try:
        email = conn.execute(
            "SELECT subject FROM emails "
            "WHERE recipient_email = ? AND folder = 'sent' LIMIT 1",
            ("marytheshot@gmail.com",),
        ).fetchone()
    finally:
        conn.close()

    if email is None:
        print("FAIL: No sent email found to marytheshot@gmail.com")
        return 0.0

    print(
        f"PASS: Found sent email to marytheshot@gmail.com (subject: {email['subject']})"
    )
    return 1.0


score = check()
print(f"Score: {score}/1.0")
sys.exit(0 if score >= 1.0 else 1)
