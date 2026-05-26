"""Verifier for expense-submit-verify (C2).

Checks: expense_draft table has status = 'submitted' for the target draft
(agent detected the silent submit failure and retried).
"""

import sqlite3
import sys

DB_PATH = "/var/lib/mock-data/expense/expense.db"


def main():
    score = 0.0
    conn = sqlite3.connect(DB_PATH)

    drafts = conn.execute("SELECT id, status FROM expense_draft ORDER BY id").fetchall()
    conn.close()

    if not drafts:
        print("No expense drafts found")
        print(f"Score: {score:.2f}/1.0")
        sys.exit(1)

    # Check if any draft has been submitted
    for did, status in drafts:
        if status == "submitted":
            # Verification (0.3) + Completion (0.7)
            score = 1.0
            break

    if score == 0.0:
        # Check if there's evidence the agent tried (status not just 'draft')
        statuses = set(s for _, s in drafts)
        if len(statuses) > 1:
            score = 0.3

    print(f"Score: {score:.2f}/1.0")
    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
