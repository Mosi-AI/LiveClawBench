#!/usr/bin/env python3
"""Verify insurance-deductible-selection task: check if Balanced Silver plan was selected
   and the active policy was updated."""

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

    # Check 1: active policy must reflect the selected plan
    cursor.execute(
        """
        SELECT cp.id, cp.plan_id, cp.status, ip.code, ip.name
        FROM current_policy cp
        JOIN insurance_plan ip ON cp.plan_id = ip.id
        WHERE cp.user_id = 1 AND cp.status = 'active'
        """
    )
    policy = cursor.fetchone()

    if not policy:
        print("FAIL: No active policy found for user 1")
        conn.close()
        return 0.0

    print(
        f"Active policy: id={policy['id']}, plan_id={policy['plan_id']}, "
        f"code={policy['code']}, name={policy['name']}"
    )

    if policy["code"] != "B" or policy["name"] != "Balanced Silver":
        if policy["code"] in VALID_PLANS and policy["name"] == VALID_PLANS[policy["code"]]:
            print(f"PARTIAL: Active policy is {policy['name']}, not Balanced Silver")
            conn.close()
            return 0.5
        print(f"FAIL: Unexpected active policy (code={policy['code']}, name={policy['name']})")
        conn.close()
        return 0.0

    # Check 2: plan_selection record must also exist
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
        print("FAIL: No plan selection record found for user 1")
        return 0.0

    print(
        f"Plan selection: code={row['plan_code_snapshot']}, name={row['plan_name_snapshot']}, "
        f"year={row['year']}, deductible={row['deductible_snapshot']}, premium={row['premium_snapshot']}"
    )

    if row["plan_code_snapshot"] == "B" and row["plan_name_snapshot"] == "Balanced Silver":
        print("PASS: Balanced Silver plan selected and active policy updated")
        return 1.0

    if row["plan_code_snapshot"] in VALID_PLANS and row["plan_name_snapshot"] == VALID_PLANS[row["plan_code_snapshot"]]:
        print(f"PARTIAL: Selection record is {row['plan_name_snapshot']}, not Balanced Silver")
        return 0.5

    print(f"FAIL: Unexpected plan selection (code={row['plan_code_snapshot']}, name={row['plan_name_snapshot']})")
    return 0.0


score = check()
print(f"Score: {score:.1f}/1.0")
sys.exit(0 if score >= 0.5 else 1)
