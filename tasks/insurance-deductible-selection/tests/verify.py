#!/usr/bin/env python3
"""Verify insurance-deductible-selection task: check if Balanced Silver plan was selected."""

import sqlite3
import sys

DB_PATH = "/var/lib/mock-data/insurance/insurance.db"


def check():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open insurance database: {e}")
        return 0.0

    # Check if a plan_selection row exists for user 1
    cursor.execute(
        """
        SELECT plan_code_snapshot, plan_name_snapshot
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

    print(f"Found plan selection: code={plan_code}, name={plan_name}")

    if plan_code != "B":
        print(f"FAIL: Expected plan code 'B', got '{plan_code}'")
        return 0.0

    if plan_name != "Balanced Silver":
        print(f"FAIL: Expected plan name 'Balanced Silver', got '{plan_name}'")
        return 0.0

    print("PASS: Balanced Silver plan selected correctly")
    return 1.0


score = check()
print(f"Score: {score}/1.0")
sys.exit(0 if score >= 1.0 else 1)
