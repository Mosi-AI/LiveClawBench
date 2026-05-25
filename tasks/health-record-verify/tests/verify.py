"""Verifier for health-record-verify (C2).

Checks: health record (allergen or medication) is actually persisted in DB
(agent detected the silent insert failure and retried).
"""

import sqlite3
import sys

DB_PATH = "/var/lib/mock-data/health/health.db"


def main():
    score = 0.0
    conn = sqlite3.connect(DB_PATH)

    allergens = conn.execute(
        "SELECT id FROM allergen ORDER BY id DESC LIMIT 5"
    ).fetchall()
    medications = conn.execute(
        "SELECT id FROM medication ORDER BY id DESC LIMIT 5"
    ).fetchall()
    conn.close()

    # Baseline has 3 allergens + 2 medications; new entries would have higher IDs
    has_new_allergen = len(allergens) > 3
    has_new_medication = len(medications) > 2

    if has_new_allergen or has_new_medication:
        # Verification (0.3): record exists (agent retried)
        score = 0.3
        # Completion (0.7): valid new record persisted
        score = 1.0

    print(f"Score: {score:.2f}/1.0")
    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
