#!/usr/bin/env python3
"""
Verifier for finance-expense-log task.

Awards partial credit per sub-task:
  - expense_report_created (0.2): report exists with trip_name="NYC Client Visit"
  - correct_categories (0.4): all 5 expense items have correct categories
  - correct_amounts (0.2): amounts are within 10% tolerance
  - report_submitted (0.2): report status is "submitted"

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
    "expense_report_created": 0.2,
    "correct_categories": 0.4,
    "correct_amounts": 0.2,
    "report_submitted": 0.2,
}

AMOUNT_TOLERANCE = 0.10  # 10% tolerance

# Expected expense items: (category, approximate amount)
# The agent must infer categories from natural language descriptions:
#   "Taxi from airport to hotel"       -> transport, ~45.00
#   "Team lunch at Italian place"      -> meals,    ~85.50
#   "Uber to client meeting"           -> transport, ~32.00
#   "Flight to New York"               -> flight,   ~450.00
#   "Marriott downtown for 3 nights"   -> hotel,    ~750.00
EXPECTED_ITEMS = [
    {"expense_category": "transport", "amount": 45.00},
    {"expense_category": "meals", "amount": 85.50},
    {"expense_category": "transport", "amount": 32.00},
    {"expense_category": "flight", "amount": 450.00},
    {"expense_category": "hotel", "amount": 750.00},
]


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


def amount_matches(expected: float, actual: float) -> bool:
    """Check if actual amount is within tolerance of expected."""
    return abs(actual - expected) / max(expected, 0.01) <= AMOUNT_TOLERANCE


def main() -> tuple[float, dict]:
    score = 0.0
    details: dict[str, list | dict] = {"messages": [], "dimension_scores": {}}

    if not os.path.exists(DB_PATH):
        details["messages"].append(f"ERROR: Database not found at {DB_PATH}")
        return score, details

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    try:
        # 1. Check expense report was created with correct trip_name
        # The seed data has reports with ids 1,2 so the new one should be id >= 3
        exp_row = conn.execute(
            "SELECT id, trip_name, total_amount, status FROM expense_report "
            "WHERE trip_name = ?",
            ("NYC Client Visit",),
        ).fetchone()

        if exp_row:
            score += record_score(
                details,
                "expense_report_created",
                True,
                f"Expense report '{exp_row['trip_name']}' created (id={exp_row['id']}, "
                f"total={exp_row['total_amount']:.2f})",
                "",
            )
        else:
            # Check if any report was created with a similar name
            alt_row = conn.execute(
                "SELECT id, trip_name FROM expense_report WHERE id > 2 "
                "AND trip_name LIKE '%NYC%'"
            ).fetchone()
            if alt_row:
                score += record_score(
                    details,
                    "expense_report_created",
                    True,
                    f"Expense report '{alt_row['trip_name']}' created (id={alt_row['id']}) "
                    f"[accepted as NYC-related trip]",
                    "",
                )
                exp_row = conn.execute(
                    "SELECT id, trip_name, total_amount, status FROM expense_report "
                    "WHERE id = ?",
                    (alt_row["id"],),
                ).fetchone()
            else:
                score += record_score(
                    details,
                    "expense_report_created",
                    False,
                    "",
                    "Expense report for NYC Client Visit not found",
                )

        if not exp_row:
            # Cannot check further dimensions without a report
            for dim in ("correct_categories", "correct_amounts", "report_submitted"):
                score += record_score(
                    details,
                    dim,
                    False,
                    "",
                    f"Cannot check {dim} -- expense report not found",
                )
            return score, details

        report_id = exp_row["id"]

        # 2. Check expense items have correct categories
        items = conn.execute(
            "SELECT expense_category, amount FROM expense_item "
            "WHERE expense_report_id = ?",
            (report_id,),
        ).fetchall()

        # Build actual category multiset and expected category multiset
        actual_categories = sorted(row["expense_category"] for row in items)
        expected_categories = sorted(
            item["expense_category"] for item in EXPECTED_ITEMS
        )

        if actual_categories == expected_categories:
            score += record_score(
                details,
                "correct_categories",
                True,
                f"All {len(items)} expense categories correct: {actual_categories}",
                "",
            )
        else:
            # Partial credit: check how many match
            correct_count = 0
            remaining_actual = list(actual_categories)
            for cat in expected_categories:
                if cat in remaining_actual:
                    remaining_actual.remove(cat)
                    correct_count += 1

            if correct_count > 0:
                partial = WEIGHTS["correct_categories"] * (
                    correct_count / len(EXPECTED_ITEMS)
                )
                details["dimension_scores"]["correct_categories"] = round(partial, 3)
                details["messages"].append(
                    f"PARTIAL: {correct_count}/{len(EXPECTED_ITEMS)} categories correct "
                    f"(got {actual_categories}, expected {expected_categories})"
                )
                score += partial
            else:
                score += record_score(
                    details,
                    "correct_categories",
                    False,
                    "",
                    f"Categories incorrect: got {actual_categories}, "
                    f"expected {expected_categories}",
                )

        # 3. Check amounts are approximately correct
        # Match items by category and check amounts
        amount_correct = 0
        amount_checked = 0

        for expected_item in EXPECTED_ITEMS:
            # Find matching actual items by category
            matching = [
                row
                for row in items
                if row["expense_category"] == expected_item["expense_category"]
            ]
            if matching:
                # Check if any matching item has a close amount
                best_match = min(
                    matching,
                    key=lambda r: abs(r["amount"] - expected_item["amount"]),
                )
                if amount_matches(expected_item["amount"], best_match["amount"]):
                    amount_correct += 1
                amount_checked += 1

        if amount_checked == len(EXPECTED_ITEMS) and amount_correct == len(
            EXPECTED_ITEMS
        ):
            score += record_score(
                details,
                "correct_amounts",
                True,
                f"All {amount_correct} expense amounts within {AMOUNT_TOLERANCE:.0%} tolerance",
                "",
            )
        elif amount_correct > 0:
            partial = WEIGHTS["correct_amounts"] * (
                amount_correct / len(EXPECTED_ITEMS)
            )
            details["dimension_scores"]["correct_amounts"] = round(partial, 3)
            details["messages"].append(
                f"PARTIAL: {amount_correct}/{len(EXPECTED_ITEMS)} amounts correct "
                f"within tolerance"
            )
            score += partial
        else:
            score += record_score(
                details,
                "correct_amounts",
                False,
                "",
                f"No amounts match within {AMOUNT_TOLERANCE:.0%} tolerance",
            )

        # 4. Check report is submitted
        status = exp_row["status"]
        score += record_score(
            details,
            "report_submitted",
            status == "submitted",
            "Expense report is submitted",
            f"Expense report status is '{status}', expected 'submitted'",
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
