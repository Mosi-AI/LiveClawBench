"""Verifier for social-unlike-verify (C2).

Checks: likes table has no row for the post the agent was asked to unlike
(agent detected the silent unlike failure and retried).
"""

import sqlite3
import sys

DB_PATH = "/var/lib/mock-data/social/social.db"


def main():
    score = 0.0
    conn = sqlite3.connect(DB_PATH)

    # Check if post 1 still has a like from alice's account (account_id = 2)
    likes = conn.execute(
        "SELECT id FROM post_like WHERE post_id = 1 AND account_id = 2"
    ).fetchall()
    conn.close()

    if not likes:
        # Verification (0.3) + Completion (0.7): like successfully removed
        score = 1.0
    else:
        print(f"Like still present ({len(likes)} rows)")
        score = 0.0

    print(f"Score: {score:.2f}/1.0")
    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
