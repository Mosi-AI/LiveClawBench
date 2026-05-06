#!/usr/bin/env python3
"""Verify insurance-deductible-selection task: check if Balanced Silver plan was selected."""

import sqlite3
import sys

DB_PATH = "/var/lib/mock-data/insurance/insurance.db"

VALID_PLANS = {
    "A": "Budget HDHP",
    "B": "Balanced Silver",
    "C": "Premier Gold",
}


def check():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open insurance database: {e}")
        return 0.0

    # Query the latest plan_selection for user 1
    cursor.execute(
        """
        SELECT plan_code_snapshot, plan_name_snapshot, year,
               deductible_snapshot, premium_snapshot
        FROM plan_selection
        WHERE user_id = 1
        ORDER BY id DESC
        LIMIT 1
        """
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        print("FAIL: No plan selection found for user 1")
        return 0.0

    plan_code = row["plan_code_snapshot"]
    plan_name = row["plan_name_snapshot"]
    year = row["year"]
    deductible = row["deductible_snapshot"]
    premium = row["premium_snapshot"]

    print(
        f"Found plan selection: code={plan_code}, name={plan_name}, "
        f"year={year}, deductible={deductible}, premium={premium}"
    )

    # Full credit only for the correct plan
    if plan_code == "B" and plan_name == "Balanced Silver":
        print("PASS: Balanced Silver plan selected correctly")
        return 1.0

    # Partial credit for a valid but wrong seeded plan
    if plan_code in VALID_PLANS and plan_name == VALID_PLANS[plan_code]:
        print(f"PARTIAL: Valid plan selected but not Balanced Silver (got {plan_name})")
        return 0.5

    print(f"FAIL: Unexpected plan selection (code={plan_code}, name={plan_name})")
    return 0.0


score = check()
print(f"Score: {score:.1f}/1.0")
sys.exit(0 if score >= 0.5 else 1)
