"""Verifier for mint-diet-stockout (C1).

Checks: food log entry exists with a valid alternative food item
(C1 deleted the originally searched food; agent must find a different one).
"""

import sqlite3
import sys

DB_PATH = "/var/lib/mock-data/mint-diet/mint-diet.sqlite"


def main():
    score = 0.0
    conn = sqlite3.connect(DB_PATH)

    entries = conn.execute(
        "SELECT e.id, e.food_catalog_id, e.food_name "
        "FROM food_entry e ORDER BY e.id DESC LIMIT 5"
    ).fetchall()

    if not entries:
        conn.close()
        print("No food log entries found")
        print(f"Score: {score:.2f}/1.0")
        sys.exit(1)

    for eid, food_catalog_id, food_name in entries:
        if food_name:
            # Detection (0.3): any food entry exists (agent adapted)
            score = max(score, 0.3)
            if food_catalog_id:
                # Recovery (0.7): catalog item still exists (not the C1-deleted food)
                exists = conn.execute(
                    "SELECT 1 FROM food_catalog WHERE id = ?", (food_catalog_id,)
                ).fetchone()
                if exists:
                    score = 1.0
                    break

    conn.close()

    print(f"Score: {score:.2f}/1.0")
    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
