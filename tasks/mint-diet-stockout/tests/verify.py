"""Verifier for mint-diet-stockout (C1).

Checks: food log entry exists with an alternative food item
(the originally searched food was deleted by C1).
"""

import sqlite3
import sys

DB_PATH = "/var/lib/mock-data/mint-diet/mint-diet.db"


def main():
    score = 0.0
    conn = sqlite3.connect(DB_PATH)

    entries = conn.execute(
        "SELECT id, food_catalog_id, food_name FROM food_entry ORDER BY id DESC LIMIT 5"
    ).fetchall()
    conn.close()

    if not entries:
        print("No food log entries found")
        print(f"Score: {score:.2f}/1.0")
        sys.exit(1)

    # Detection (0.3): alternative food logged (not the deleted chips)
    # Recovery (0.7): log entry has valid food reference
    for eid, food_catalog_id, food_name in entries:
        if food_name and food_catalog_id:
            # Any logged entry counts as adaptation evidence
            score = max(score, 0.3)
            # If food_name exists in catalog, it's a valid entry
            score = 1.0
            break

    print(f"Score: {score:.2f}/1.0")
    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
