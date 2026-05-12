#!/usr/bin/env python3
"""
Verify grocery-reorder task: 5-dimension scoring with gate condition.

Dimensions:
- D1: Eggs entry in smarthome grocery_product table (SQLite) with quantity=36, unit='pieces' (0.25)
- D2: Shop order (JSON orders file) with egg product and OrderItem.quantity=3 (3 dozen) (0.25)
- D3: grocery_product.reference matches shop order_id (0.25)
- D4: Agent response contains rounding keywords (0.15, mandatory)
- D5: Existing entries (PROD001, PROD002) unchanged (0.10, gated by D1-3)

Zero-work baseline: 0.0 (D5 gate prevents bonus without D1-3)
"""

import json
import sqlite3
import sys
from pathlib import Path


def get_last_assistant_message():
    """Extract the last assistant message content from harbor.jsonl with fallback paths."""
    fallback_log_paths = [
        Path("/workspace/.openclaw/agents/main/sessions/harbor.jsonl"),
        Path("/root/.openclaw/agents/main/sessions/harbor.jsonl"),
        Path("/logs/agent/openclaw-state/agents/main/sessions/harbor.jsonl"),
    ]

    actual_log_path = None
    for path in fallback_log_paths:
        if path.exists():
            actual_log_path = path
            break

    if actual_log_path is None:
        return None

    last_content = None
    with open(actual_log_path, "r") as f:
        for line in f:
            try:
                entry = json.loads(line)
                if entry.get("type") == "message" and entry.get("message", {}).get("role") == "assistant":
                    content = entry["message"].get("content")
                    if content is None:
                        continue
                    if isinstance(content, list):
                        text_parts = [
                            block.get("text", "")
                            for block in content
                            if block.get("type") == "text" and block.get("text")
                        ]
                        last_content = " ".join(text_parts)
                    elif isinstance(content, str):
                        last_content = content
            except json.JSONDecodeError:
                continue
    return last_content


def check_dimension_1(conn):
    """D1: Eggs entry in grocery_product with quantity=36, unit='pieces'."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT quantity, unit FROM grocery_product WHERE name LIKE '%egg%' OR product_id LIKE '%egg%'"
    )
    rows = cursor.fetchall()
    for row in rows:
        quantity, unit = row
        if quantity == 36.0 and unit == "pieces":
            return True
    return False


def check_dimension_2(orders):
    """D2: Shop order with egg product and quantity=3 (3 dozen)."""
    for order in orders:
        for item in order.get("items", []):
            product_id = item.get("product_id", "")
            title = item.get("title", "").lower()
            quantity = item.get("quantity", 0)
            # Check for egg product with quantity 3 (3 dozen)
            if ("egg" in product_id.lower() or "egg" in title) and quantity == 3:
                return True
    return False


def check_dimension_3(conn, orders):
    """D3: grocery_product.reference matches shop order_id."""
    cursor = conn.cursor()
    # Find eggs entry in grocery_product
    cursor.execute(
        "SELECT reference FROM grocery_product WHERE name LIKE '%egg%' OR product_id LIKE '%egg%'"
    )
    rows = cursor.fetchall()
    if not rows:
        return False

    for row in rows:
        reference = row[0]
        if reference:
            # Check if this reference exists in orders
            for order in orders:
                if order.get("order_id") == reference:
                    return True
    return False


def check_dimension_4():
    """D4: Agent response contains rounding keywords."""
    response = get_last_assistant_message()
    if response is None:
        return False

    rounding_keywords = ["round", "rounding", "dozen", "convert", "conversion", "adjust"]
    response_lower = response.lower()
    return any(kw in response_lower for kw in rounding_keywords)


def check_dimension_5(conn):
    """D5: Existing entries (PROD001, PROD002) unchanged."""
    cursor = conn.cursor()
    # Check PROD001
    cursor.execute(
        "SELECT quantity, unit, reference FROM grocery_product WHERE product_id = 'PROD001'"
    )
    row = cursor.fetchone()
    if row is None:
        return False
    if row[0] != 1.0 or row[1] != "gallon" or row[2] != "ORD000001":
        return False

    # Check PROD002
    cursor.execute(
        "SELECT quantity, unit, reference FROM grocery_product WHERE product_id = 'PROD002'"
    )
    row = cursor.fetchone()
    if row is None:
        return False
    if row[0] != 1.0 or row[1] != "lb" or row[2] != "ORD000002":
        return False

    return True


def main():
    score = 0.0
    results = {}

    # Connect to smarthome SQLite
    smarthome_path = "/tmp/mosi_smart_home.sqlite"
    try:
        conn = sqlite3.connect(smarthome_path)
    except sqlite3.Error:
        print("Error: Cannot connect to smarthome database")
        print(f"Score: {score}/1.0")
        sys.exit(1)

    # Load shop orders JSON
    orders_path = "/tmp/mosi_shop_orders.json"
    try:
        with open(orders_path) as f:
            orders = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        orders = []

    # Check D1
    d1_pass = check_dimension_1(conn)
    results["D1"] = d1_pass
    if d1_pass:
        score += 0.25

    # Check D2
    d2_pass = check_dimension_2(orders)
    results["D2"] = d2_pass
    if d2_pass:
        score += 0.25

    # Check D3
    d3_pass = check_dimension_3(conn, orders)
    results["D3"] = d3_pass
    if d3_pass:
        score += 0.25

    # Check D4 (mandatory)
    d4_pass = check_dimension_4()
    results["D4"] = d4_pass
    if d4_pass:
        score += 0.15

    # Check D5 (gated by D1-3)
    d5_pass = False
    if d1_pass and d2_pass and d3_pass:
        d5_pass = check_dimension_5(conn)
    results["D5"] = d5_pass
    if d5_pass:
        score += 0.10

    conn.close()

    # Print results
    print(f"D1 (Eggs in grocery_product): {'PASS' if d1_pass else 'FAIL'}")
    print(f"D2 (Shop order for 3 dozen): {'PASS' if d2_pass else 'FAIL'}")
    print(f"D3 (Reference match): {'PASS' if d3_pass else 'FAIL'}")
    print(f"D4 (Rounding explanation): {'PASS' if d4_pass else 'FAIL'}")
    print(f"D5 (Existing entries unchanged): {'PASS' if d5_pass else 'FAIL' if d1_pass and d2_pass and d3_pass else 'SKIPPED (D1-3 not all pass)'}")
    print(f"Score: {score:.2f}/1.0")

    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
