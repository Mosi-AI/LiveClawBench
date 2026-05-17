#!/usr/bin/env python3
"""
Verifier for finance-monthly-close task.

Awards partial credit per sub-task:
  - Account flagging (0.2): ACC-1002 is flagged
  - Transaction flagging (0.2): ids 2, 4, 8 are flagged
  - Expense report created (0.2): trip_name="March Marketing Trip", total_amount=2450.0
  - Expense report submitted (0.1): status="submitted"
  - Invoice created (0.2): invoice_number="INV-2026-004", vendor_id=2, date="2026-03-01"
  - Invoice line items (0.1): 2 items with categories 5100 and 5400

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
    "account_flagging": 0.2,
    "transaction_flagging": 0.2,
    "expense_report_created": 0.2,
    "expense_report_submitted": 0.1,
    "invoice_created": 0.2,
    "invoice_line_items": 0.1,
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


def main() -> tuple[float, dict]:
    score = 0.0
    details: dict[str, list | dict] = {"messages": [], "dimension_scores": {}}

    if not os.path.exists(DB_PATH):
        details["messages"].append(f"ERROR: Database not found at {DB_PATH}")
        return score, details

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    try:
        # 1. Account flagging: ACC-1002 should be flagged
        acc_row = conn.execute(
            "SELECT status FROM account_balance WHERE account_id = ?", ("ACC-1002",)
        ).fetchone()
        status = acc_row["status"] if acc_row else "missing"
        score += record_score(
            details,
            "account_flagging",
            acc_row is not None and acc_row["status"] == "flagged",
            "ACC-1002 is flagged",
            f"ACC-1002 status is '{status}', expected 'flagged'",
        )

        # 2. Transaction flagging: ids 2, 4, 8 should be flagged
        flagged_txns = conn.execute(
            "SELECT id, status FROM transaction_record WHERE id IN (2, 4, 8)"
        ).fetchall()
        flagged_ids = {row["id"] for row in flagged_txns if row["status"] == "flagged"}
        expected_txn_ids = {2, 4, 8}
        missing = expected_txn_ids - flagged_ids
        score += record_score(
            details,
            "transaction_flagging",
            flagged_ids == expected_txn_ids,
            "Transactions 2, 4, 8 are flagged",
            f"Transactions not flagged: {missing}",
        )

        # 3. Expense report created: "March Marketing Trip", total ~2450.0
        exp_row = conn.execute(
            "SELECT id, trip_name, total_amount, status FROM expense_report WHERE trip_name = ?",
            ("March Marketing Trip",),
        ).fetchone()
        if exp_row and abs(exp_row["total_amount"] - 2450.0) <= TOLERANCE:
            score += record_score(
                details,
                "expense_report_created",
                True,
                f"Expense report '{exp_row['trip_name']}' created with total {exp_row['total_amount']:.2f}",
                "",
            )
        else:
            fail_msg = (
                "Expense report 'March Marketing Trip' not found"
                if not exp_row
                else f"Expense report total = {exp_row['total_amount']:.2f}, expected 2450.00"
            )
            score += record_score(
                details, "expense_report_created", False, "", fail_msg
            )

        # 4. Expense report submitted
        status = exp_row["status"] if exp_row else "missing"
        score += record_score(
            details,
            "expense_report_submitted",
            exp_row is not None and exp_row["status"] == "submitted",
            "Expense report is submitted",
            f"Expense report status is '{status}', expected 'submitted'",
        )

        # 5. Invoice created: INV-2026-004 for Globex Systems
        inv_row = conn.execute(
            "SELECT id, vendor_id, vendor_name, invoice_number, invoice_date FROM invoice WHERE invoice_number = ?",
            ("INV-2026-004",),
        ).fetchone()
        if (
            inv_row
            and inv_row["vendor_id"] == 2
            and inv_row["invoice_date"] == "2026-03-01"
        ):
            score += record_score(
                details,
                "invoice_created",
                True,
                f"Invoice {inv_row['invoice_number']} created for {inv_row['vendor_name']} on {inv_row['invoice_date']}",
                "",
            )
        else:
            fail_msg = (
                "Invoice 'INV-2026-004' not found"
                if not inv_row
                else f"Invoice vendor_id={inv_row['vendor_id']} date={inv_row['invoice_date']}, expected vendor_id=2 date=2026-03-01"
            )
            score += record_score(details, "invoice_created", False, "", fail_msg)

        # 6. Invoice line items: 2 items with categories 5100 and 5400
        if inv_row:
            line_items = conn.execute(
                "SELECT description, category_code, amount FROM invoice_line_item WHERE invoice_id = ?",
                (inv_row["id"],),
            ).fetchall()
            categories = {row["category_code"] for row in line_items}
            actual_cats = [row["category_code"] for row in line_items]
            score += record_score(
                details,
                "invoice_line_items",
                categories == {"5100", "5400"} and len(line_items) == 2,
                "Invoice has 2 line items with categories 5100 and 5400",
                f"Invoice line item categories: {actual_cats}, expected ['5100', '5400'] with exactly 2 items",
            )
        else:
            score += record_score(
                details,
                "invoice_line_items",
                False,
                "",
                "Cannot check line items — invoice not found",
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
