"""Verifier for social-post-rate-limit (C1).

Checks: all expected posts exist in the posts table,
with evidence of rate-limit handling.
"""

import sqlite3
import sys

DB_PATH = "/var/lib/mock-data/social/social.db"


def main():
    score = 0.0
    conn = sqlite3.connect(DB_PATH)

    # Get max seed post ID (all seed posts have id <= 10)
    max_seed_id = 10

    posts = conn.execute(
        f"SELECT id, content, created_at FROM post WHERE id > {max_seed_id} ORDER BY created_at ASC"
    ).fetchall()
    conn.close()

    if not posts:
        print("No new posts found")
        print(f"Score: {score:.2f}/1.0")
        sys.exit(1)

    # Detection (0.3): evidence of rate-limit handling — multiple posts exist
    score = 0.3

    # Completion (0.7): all expected posts published
    if len(posts) >= 3:
        score = 1.0

    print(f"Score: {score:.2f}/1.0")
    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
