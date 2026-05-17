#!/usr/bin/env python3
"""
Verifier for finance-invoice-process task.

Awards partial credit per invoice:
  - invoice_10_created (0.3): INV-2026-010 exists with vendor_id=1 (Acme Corp), date=2026-03-01
  - invoice_10_items (0.2): 2 line items with category codes 5300 (~15000) and 5400 (~5000)
  - invoice_11_created (0.3): INV-2026-011 exists with vendor_id=3 (Initech Solutions), date=2026-03-05
  - invoice_11_items (0.2): 2 line items with category code 5400, amounts ~8000 and ~3500

Aggregate score = sum of earned weights.
"""

import json
import os
import sqlite3
import sys
import traceback

DB_PATH = os.environ.get("MOCK_FINANCE_DB_PATH", "/opt/mock/data/finance_app.sqlite")

# Sub-task weights
WEIGHTS = {
    "invoice_10_created": 0.3,
    "invoice_10_items": 0.2,
    "invoice_11_created": 0.3,
    "invoice_11_items": 0.2,
}

TOLERANCE = 0.01


def record_score(
    details: dict,
    dimension: str,
    passed: bool,
    pass_msg: str,
    fail_msg: str,
) -> float:
    """Record a dimension score and message, returning the earned weight."""
    if passed:
        details["dimension_scores"][dimension] = WEIGHTS[dimension]
        details["messages"].append(f"PASS: {pass_msg}")
        return WEIGHTS[dimension]
    details["dimension_scores"][dimension] = 0.0
    details["messages"].append(f"FAIL: {fail_msg}")
    return 0.0


def check_invoice_created(
    conn, details, invoice_number, expected_vendor_id, expected_date, dimension
):
    """Check that an invoice exists with the given number, vendor, and date."""
    inv_row = conn.execute(
        "SELECT id, vendor_id, vendor_name, invoice_number, invoice_date FROM invoice WHERE invoice_number = ?",
        (invoice_number,),
    ).fetchone()
    if (
        inv_row
        and inv_row["vendor_id"] == expected_vendor_id
        and inv_row["invoice_date"] == expected_date
    ):
        score = record_score(
            details,
            dimension,
            True,
            f"Invoice {inv_row['invoice_number']} created for {inv_row['vendor_name']} on {inv_row['invoice_date']}",
            "",
        )
        return score, inv_row
    fail_msg = (
        f"Invoice '{invoice_number}' not found"
        if not inv_row
        else f"Invoice vendor_id={inv_row['vendor_id']} date={inv_row['invoice_date']}, expected vendor_id={expected_vendor_id} date={expected_date}"
    )
    score = record_score(details, dimension, False, "", fail_msg)
    return score, inv_row


def check_invoice_items(conn, details, inv_row, dimension, expected_items):
    """Check invoice line items match expected descriptions, category codes, and amounts.

    expected_items: list of (description_substring, category_code, expected_amount)
    Each expected item must match a distinct actual item. We match by category_code + amount tolerance.
    """
    if not inv_row:
        return record_score(
            details,
            dimension,
            False,
            "",
            "Cannot check line items -- invoice not found",
        )

    line_items = conn.execute(
        "SELECT description, category_code, amount FROM invoice_line_item WHERE invoice_id = ?",
        (inv_row["id"],),
    ).fetchall()

    if len(line_items) != len(expected_items):
        return record_score(
            details,
            dimension,
            False,
            "",
            f"Expected {len(expected_items)} line items, found {len(line_items)}",
        )

    # Match each expected item to an actual item by category_code and amount tolerance
    used = set()
    for exp_desc, exp_code, exp_amount in expected_items:
        matched = False
        for i, item in enumerate(line_items):
            if i in used:
                continue
            if (
                item["category_code"] == exp_code
                and abs(item["amount"] - exp_amount) <= TOLERANCE
            ):
                used.add(i)
                matched = True
                break
        if not matched:
            actual_items = [(r["category_code"], r["amount"]) for r in line_items]
            expected_str = [
                (exp_code, exp_amount) for _, exp_code, exp_amount in expected_items
            ]
            return record_score(
                details,
                dimension,
                False,
                "",
                f"Line items mismatch. Expected {expected_str}, got {actual_items}",
            )

    items_desc = ", ".join(
        f"{r['category_code']}:${r['amount']:.2f}" for r in line_items
    )
    return record_score(
        details,
        dimension,
        True,
        f"Invoice line items correct: {items_desc}",
        "",
    )


def main() -> tuple[float, dict]:
    score = 0.0
    details: dict[str, list | dict] = {"messages": [], "dimension_scores": {}}

    if not os.path.exists(DB_PATH):
        details["messages"].append(f"ERROR: Database not found at {DB_PATH}")
        return score, details

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    try:
        # 1. Invoice INV-2026-010: vendor_id=1 (Acme Corp), date=2026-03-01
        s, inv_10 = check_invoice_created(
            conn, details, "INV-2026-010", 1, "2026-03-01", "invoice_10_created"
        )
        score += s

        # 2. INV-2026-010 line items: Software License (5300, 15000) + Technical Support (5400, 5000)
        score += check_invoice_items(
            conn,
            details,
            inv_10,
            "invoice_10_items",
            [
                ("Software License", "5300", 15000.0),
                ("Technical Support", "5400", 5000.0),
            ],
        )

        # 3. Invoice INV-2026-011: vendor_id=3 (Initech Solutions), date=2026-03-05
        s, inv_11 = check_invoice_created(
            conn, details, "INV-2026-011", 3, "2026-03-05", "invoice_11_created"
        )
        score += s

        # 4. INV-2026-011 line items: System Integration (5400, 8000) + Training Services (5400, 3500)
        score += check_invoice_items(
            conn,
            details,
            inv_11,
            "invoice_11_items",
            [
                ("System Integration", "5400", 8000.0),
                ("Training Services", "5400", 3500.0),
            ],
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
        reward_json = {"reward": round(score, 2)}
        reward_json.update(details["dimension_scores"])
        with open("/logs/verifier/reward.json", "w") as f:
            json.dump(reward_json, f, indent=2)
    except Exception:
        pass

    sys.exit(0 if score >= 0.5 else 1)
