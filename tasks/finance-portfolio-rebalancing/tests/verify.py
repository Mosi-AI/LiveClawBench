#!/usr/bin/env python3
"""
Verifier for finance-portfolio-rebalancing task.

Scores based on final portfolio holdings (ground truth). If holdings match targets,
score is 1.0. Otherwise, partial credit is awarded based on correct orders placed.

Pre-existing seedV2 orders (3) are excluded from order checks:
  - eq buy 5000.0 (executed)
  - fi sell 3000.0 (executed)
  - al buy 2000.0 (submitted)

Target holdings:
  - eq: 112500, fi: 75000, ca: 37500, al: 25000

Expected new orders:
  - eq buy 12500, fi sell 5000, ca sell 12500, al buy 5000
"""

import json
import os
import sqlite3
import sys
import traceback

DB_PATH = os.environ.get("MOCK_FINANCE_DB_PATH", "/opt/mock/data/finance_app.sqlite")

# Pre-existing orders from seedV2 (excluded from scoring)
SEEDED_ORDERS = {
    ("eq", "buy", 5000.0),
    ("fi", "sell", 3000.0),
    ("al", "buy", 2000.0),
}

# Target holdings: asset_class_code -> target_value
TARGET_HOLDINGS = {
    "eq": 112500.0,
    "fi": 75000.0,
    "ca": 37500.0,
    "al": 25000.0,
}

# Expected new orders for partial credit fallback
EXPECTED_ORDERS = {
    ("eq", "buy", 12500.0),
    ("fi", "sell", 5000.0),
    ("ca", "sell", 12500.0),
    ("al", "buy", 5000.0),
}

TOLERANCE = 1.0


def orders_match(a: tuple, b: tuple) -> bool:
    """Return True if two orders match within tolerance."""
    return a[0] == b[0] and a[1] == b[1] and abs(a[2] - b[2]) <= TOLERANCE


def main() -> tuple[float, dict]:
    score = 0.0
    details: dict[str, list[str]] = {"messages": []}

    if not os.path.exists(DB_PATH):
        details["messages"].append(f"ERROR: Database not found at {DB_PATH}")
        return score, details

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    try:
        # Check holdings
        rows = conn.execute(
            "SELECT asset_class_code, current_value FROM portfolio_holding"
        ).fetchall()
        holdings = {row["asset_class_code"]: row["current_value"] for row in rows}

        correct_holdings = 0
        for code, target in TARGET_HOLDINGS.items():
            actual = holdings.get(code)
            if actual is None:
                details["messages"].append(f"FAIL: Missing holding for {code}")
            elif abs(actual - target) <= TOLERANCE:
                correct_holdings += 1
                details["messages"].append(
                    f"PASS: {code} holding = {actual:.2f} (target {target:.2f})"
                )
            else:
                details["messages"].append(
                    f"FAIL: {code} holding = {actual:.2f} (target {target:.2f})"
                )

        if correct_holdings == len(TARGET_HOLDINGS):
            score = 1.0
            details["messages"].append("PASS: All holdings match target allocations")
        else:
            # Partial credit: count correct new orders
            order_rows = conn.execute(
                "SELECT asset_class_code, direction, amount FROM portfolio_order"
            ).fetchall()
            orders = {
                (row["asset_class_code"], row["direction"], row["amount"])
                for row in order_rows
            }
            net_orders = orders - SEEDED_ORDERS

            correct_orders = 0
            for expected in EXPECTED_ORDERS:
                matched = any(orders_match(actual, expected) for actual in net_orders)
                if matched:
                    correct_orders += 1
                    details["messages"].append(
                        f"PASS: Order {expected[0]} {expected[1]} {expected[2]:.2f} found"
                    )
                else:
                    details["messages"].append(
                        f"FAIL: Missing order {expected[0]} {expected[1]} {expected[2]:.2f}"
                    )

            score = correct_orders / len(EXPECTED_ORDERS)
            details["messages"].append(
                f"INFO: {correct_orders}/{len(EXPECTED_ORDERS)} correct orders"
            )

    except Exception as e:
        details["messages"].append(f"ERROR: {e}")
        details["messages"].append(traceback.format_exc())
    finally:
        conn.close()

    return score, details


if __name__ == "__main__":
    score, details = main()

    print(f"Score: {score:.2f}/1.0")
    for msg in details["messages"]:
        print(f"  {msg}")

    # Write reward.json breakdown
    try:
        reward_json = {
            "reward": round(score, 2),
            "holdings_correct": 1.0 if score == 1.0 else 0.0,
        }
        if score < 1.0:
            reward_json["orders_score"] = round(score, 2)
        with open("/logs/verifier/reward.json", "w") as f:
            json.dump(reward_json, f, indent=2)
    except Exception:
        pass

    sys.exit(0 if score >= 0.5 else 1)
