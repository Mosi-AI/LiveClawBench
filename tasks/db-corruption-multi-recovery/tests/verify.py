#!/usr/bin/env python3
"""
Verification script for db-corruption-multi-recovery task.

Scoring criteria (total 1.0):
  1. orders.json completeness (50 records expected)  -> 0.30
  2. users.json recovery rate (≥ 90 of 100)          -> 0.30
  3. JSON schema validity                              -> 0.10
  4. Foreign key consistency (orders.user_id in users) -> 0.30
"""

import json
import os
import sys

GOLDEN_DIR = "/workspace/environment/.golden"
OUTPUT_DIR = "/workspace/output"


def load_golden(name):
    path = os.path.join(GOLDEN_DIR, name)
    with open(path) as f:
        return json.load(f)


def load_output(name):
    path = os.path.join(OUTPUT_DIR, name)
    if not os.path.exists(path):
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except (json.JSONDecodeError, Exception):
        return None


def check_orders():
    """Check orders.json completeness."""
    golden = load_golden("orders_golden.json")
    output = load_output("orders.json")
    if output is None:
        print("FAIL: orders.json not found or invalid JSON")
        return 0.0

    if not isinstance(output, list):
        print("FAIL: orders.json is not a JSON array")
        return 0.0

    golden_ids = {o["id"] for o in golden}
    output_ids = {o.get("id") for o in output if isinstance(o, dict)}

    recovered = len(golden_ids & output_ids)
    total = len(golden_ids)
    rate = recovered / total if total > 0 else 0

    # Full score requires all 50 (including the 5 in WAL)
    score = rate * 0.30
    print(f"Orders: recovered {recovered}/{total} records (score: {score:.3f}/0.30)")
    return score


def check_users():
    """Check users.json recovery rate."""
    golden = load_golden("users_golden.json")
    output = load_output("users.json")
    if output is None:
        print("FAIL: users.json not found or invalid JSON")
        return 0.0

    if not isinstance(output, list):
        print("FAIL: users.json is not a JSON array")
        return 0.0

    golden_ids = {u["id"] for u in golden}
    output_ids = {u.get("id") for u in output if isinstance(u, dict)}

    recovered = len(golden_ids & output_ids)
    total = len(golden_ids)
    rate = recovered / total if total > 0 else 0

    # ≥ 90% gets full score, linear scale
    if rate >= 0.90:
        score = 0.30
    else:
        score = (rate / 0.90) * 0.30

    print(
        f"Users: recovered {recovered}/{total} records, rate={rate:.1%} (score: {score:.3f}/0.30)"
    )
    return score


def check_schema():
    """Check JSON schema validity for both outputs."""
    orders = load_output("orders.json")
    users = load_output("users.json")
    score = 0.0

    orders_keys = {"id", "user_id", "product", "amount", "status", "created_at"}
    users_keys = {"id", "username", "email", "role", "created_at"}

    if orders and isinstance(orders, list) and len(orders) > 0:
        sample = orders[0]
        if isinstance(sample, dict) and orders_keys.issubset(set(sample.keys())):
            score += 0.05
            print("PASS: orders.json schema valid")
        else:
            print(f"FAIL: orders.json missing keys (expected {orders_keys})")
    else:
        print("FAIL: orders.json empty or not a list")

    if users and isinstance(users, list) and len(users) > 0:
        sample = users[0]
        if isinstance(sample, dict) and users_keys.issubset(set(sample.keys())):
            score += 0.05
            print("PASS: users.json schema valid")
        else:
            print(f"FAIL: users.json missing keys (expected {users_keys})")
    else:
        print("FAIL: users.json empty or not a list")

    return score


def check_foreign_keys():
    """Check that all orders.user_id reference valid users."""
    orders = load_output("orders.json")
    users = load_output("users.json")

    if not orders or not users:
        print("FAIL: Cannot check FK — missing output files")
        return 0.0

    user_ids = set()
    for u in users:
        if isinstance(u, dict) and "id" in u:
            user_ids.add(u["id"])

    if not user_ids:
        print("FAIL: No valid user IDs found")
        return 0.0

    total_orders = 0
    valid_fk = 0
    for o in orders:
        if isinstance(o, dict) and "user_id" in o:
            total_orders += 1
            if o["user_id"] in user_ids:
                valid_fk += 1

    if total_orders == 0:
        print("FAIL: No orders with user_id found")
        return 0.0

    rate = valid_fk / total_orders
    score = rate * 0.30
    print(
        f"FK consistency: {valid_fk}/{total_orders} valid ({rate:.1%}) (score: {score:.3f}/0.30)"
    )
    return score


def main():
    scores = {}
    scores["orders"] = check_orders()
    scores["users"] = check_users()
    scores["schema"] = check_schema()
    scores["foreign_keys"] = check_foreign_keys()

    total = sum(scores.values())
    print(f"\nScore: {total:.2f}/1.0")

    try:
        with open("/logs/verifier/reward.json", "w") as f:
            json.dump(
                {
                    "reward": round(total, 2),
                    **{k: round(v, 3) for k, v in scores.items()},
                },
                f,
                indent=2,
            )
    except Exception:
        pass

    sys.exit(0 if total >= 0.5 else 1)


if __name__ == "__main__":
    main()
