#!/usr/bin/env python3
"""
Verify grocery-reorder task: 5-dimension scoring with gate condition.

Dimensions:
- D1: Eggs entry in smarthome grocery_product table (SQLite) with quantity=36 pieces or 3 dozen (0.25)
- D2: Shop order (JSON orders file) with egg product and OrderItem.quantity=3 (3 dozen) (0.25)
- D3: The SAME eggs entry has reference matching the EXACT egg order from D2 (0.25)
- D4: Agent response contains explicit rounding/up-sizing explanation (0.15, mandatory)
- D5: Existing entries (PROD001, PROD002) unchanged (0.10, gated by D1-3)

Note: D1 only accepts 36 pieces or 3 dozen (not 30 pieces) because eggs are sold
by the dozen, so valid quantities must be multiples of 12.

Note: D4 requires explicit rounding language (round, convert, adjust, "up to", "instead of"),
not just a bare "dozen" mention.

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
                if (
                    entry.get("type") == "message"
                    and entry.get("message", {}).get("role") == "assistant"
                ):
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


def find_egg_row(conn):
    """Find the egg row in grocery_product with correct quantity and unit.

    Returns the product_id of the qualifying row, or None if not found.
    This ensures D1 and D3 are evaluated against the SAME row.

    Accepts valid order quantities (eggs sold by the dozen, must be multiples of 12):
    - 36.0 pieces (3 dozen = 36 pieces)
    - 3.0 dozen (direct dozen entry)

    Does NOT accept 30 pieces because eggs are sold by the dozen,
    so valid quantities must be multiples of 12.
    """
    cursor = conn.cursor()
    # Check for pieces entry (36 = 3 dozen)
    cursor.execute(
        "SELECT product_id FROM grocery_product WHERE (name LIKE '%egg%' OR product_id LIKE '%egg%') AND quantity = 36.0 AND unit = 'pieces'"
    )
    row = cursor.fetchone()
    if row:
        return row[0]

    # Check for dozen entry (3 dozen)
    cursor.execute(
        "SELECT product_id FROM grocery_product WHERE (name LIKE '%egg%' OR product_id LIKE '%egg%') AND quantity = 3.0 AND unit = 'dozen'"
    )
    row = cursor.fetchone()
    return row[0] if row else None


def check_dimension_1(conn):
    """D1: Eggs entry in grocery_product with correct quantity and unit.

    Returns (pass, egg_product_id) where egg_product_id identifies the specific row.

    Accepts valid order quantities (eggs sold by the dozen):
    - 36 pieces (3 dozen = 36 pieces)
    - 3 dozen (direct dozen entry)

    Does NOT accept 30 pieces because eggs are sold by the dozen,
    so valid quantities must be multiples of 12.
    """
    egg_product_id = find_egg_row(conn)
    return egg_product_id is not None, egg_product_id


def check_dimension_2(orders):
    """D2: Shop order with egg product and quantity=3 (3 dozen).

    Returns (pass, egg_order_id) where egg_order_id is the actual order found.
    """
    for order in orders:
        for item in order.get("items", []):
            product_id = item.get("product_id", "")
            title = item.get("title", "").lower()
            quantity = item.get("quantity", 0)
            # Check for egg product with quantity 3 (3 dozen)
            if ("egg" in product_id.lower() or "egg" in title) and quantity == 3:
                return True, order.get("order_id")
    return False, None


def check_dimension_3(conn, egg_product_id, expected_order_id):
    """D3: The SAME egg row from D1 has reference matching the EXACT egg order from D2.

    This enforces that the agent correctly links the Shopping List entry
    to the specific order they placed for eggs, on the same row that has
    the correct quantity and unit.
    """
    if egg_product_id is None or expected_order_id is None:
        return False

    cursor = conn.cursor()
    cursor.execute(
        "SELECT reference FROM grocery_product WHERE product_id = ?", (egg_product_id,)
    )
    row = cursor.fetchone()
    if row is None:
        return False

    return row[0] == expected_order_id


def check_dimension_4():
    """D4: Agent response explains the rounding/up-sizing reasoning.

    Checks the last assistant message from harbor.jsonl agent logs.
    This ensures the agent actually explained the reasoning to the user,
    not just wrote to an internal file.

    Fallback to response.txt only when harbor.jsonl doesn't exist
    (oracle solution scenario - shell script cannot write to harbor.jsonl).

    Requires explicit rounding/up-sizing language such as:
    - "round up", "rounded up", "rounding" (explicit rounding)
    - "convert", "conversion" (unit conversion)
    - "adjust", "adjusted" (quantity adjustment)
    - "up to 3 dozen", "bought 3 dozen instead of 2.5" (up-sizing explanation)
    - "dozen only", "since dozen-only, I bought 3" (natural explanation)

    Does NOT accept bare "dozen" mention - must explain WHY the quantity
    was chosen (the rounding/up-sizing decision).
    """
    import re

    response = get_last_assistant_message()

    # Fallback to oracle solution output file ONLY if no harbor.jsonl exists
    # This allows oracle shell scripts to pass D4 while ensuring real agents
    # must communicate the reasoning to the user
    if response is None:
        harbor_exists = any(
            Path(p).exists()
            for p in [
                Path("/workspace/.openclaw/agents/main/sessions/harbor.jsonl"),
                Path("/root/.openclaw/agents/main/sessions/harbor.jsonl"),
                Path("/logs/agent/openclaw-state/agents/main/sessions/harbor.jsonl"),
            ]
        )
        if not harbor_exists:
            response_path = Path("/workspace/output/response.txt")
            if response_path.exists():
                response = response_path.read_text()

    if response is None:
        return False

    response_lower = response.lower()

    # Must contain explicit rounding/up-sizing language
    # "dozen" alone is NOT sufficient - must explain the rounding decision
    rounding_patterns = [
        "round",
        "rounding",
        "convert",
        "conversion",
        "adjust",
        "up to",  # "rounded up to 3 dozen"
        "instead of",  # "bought 3 dozen instead of 2.5"
    ]
    if any(pattern in response_lower for pattern in rounding_patterns):
        return True

    # Additional pattern: "dozen" + "only" + number 3 (e.g., "since dozen-only, I bought 3")
    # This captures natural explanations like "eggs are sold by dozen only, so I ordered 3"
    # The number MUST be 3 (or "three") since that's the correct answer (3 dozen = 36 eggs)
    if "dozen" in response_lower and "only" in response_lower:
        # Check for number 3 or word "three" in the response
        if re.search(r"\b3\b", response_lower) or "three" in response_lower:
            return True

    return False


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
    egg_product_id = None
    egg_order_id = None

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

    # Check D1 - returns the specific egg row product_id
    d1_pass, egg_product_id = check_dimension_1(conn)
    results["D1"] = d1_pass
    if d1_pass:
        score += 0.25

    # Check D2 - returns both pass status and the actual egg order ID
    d2_pass, egg_order_id = check_dimension_2(orders)
    results["D2"] = d2_pass
    if d2_pass:
        score += 0.25

    # Check D3 - must match the EXACT egg order from D2 on the SAME row from D1
    d3_pass = check_dimension_3(conn, egg_product_id, egg_order_id)
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
    if egg_product_id:
        print(f"    -> Found egg row: {egg_product_id}")
    print(f"D2 (Shop order for 3 dozen): {'PASS' if d2_pass else 'FAIL'}")
    if d2_pass and egg_order_id:
        print(f"    -> Found egg order: {egg_order_id}")
    print(f"D3 (Reference match on same row): {'PASS' if d3_pass else 'FAIL'}")
    if egg_product_id and egg_order_id:
        print(f"    -> Row {egg_product_id} reference must equal {egg_order_id}")
    print(f"D4 (Rounding explanation): {'PASS' if d4_pass else 'FAIL'}")
    print(
        f"D5 (Existing entries unchanged): {'PASS' if d5_pass else 'FAIL' if d1_pass and d2_pass and d3_pass else 'SKIPPED (D1-3 not all pass)'}"
    )
    print(f"Score: {score:.2f}/1.0")

    # D3 (reference match) and D4 (rounding explanation) are mandatory
    # Agent must link the order reference AND explain the conversion
    mandatory_pass = d3_pass and d4_pass
    sys.exit(0 if score >= 0.5 and mandatory_pass else 1)


if __name__ == "__main__":
    main()
