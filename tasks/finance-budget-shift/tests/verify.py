"""Verifier for finance-budget-shift (A1+A2+C1).

Multi-dimensional scoring:
  a2_fix (0.20): A2 corruption fixed (Sales no longer has negative expense)
  c1_detection (0.30): lowered budgets exist for non-violating departments
  alert_setup (0.50): budget alert correctly set up for Marketing at 80% of budget
"""

import json
import sqlite3
import sys

DB_PATH = "/opt/mock/data/finance_app.sqlite"


def main():
    score = 0.0
    dimensions = {}

    try:
        conn = sqlite3.connect(DB_PATH)
    except Exception:
        conn = sqlite3.connect("/workspace/finance.db")

    # Load March 2026 department records
    try:
        records = conn.execute(
            "SELECT department_name, budget_amount, actual_expense_amount "
            "FROM department_financial_record WHERE month = '2026-03'"
        ).fetchall()
    except Exception:
        records = []

    # Load budget alerts
    try:
        alerts = conn.execute(
            "SELECT department_name, threshold, month FROM budget_alert"
        ).fetchall()
    except Exception:
        alerts = []

    records_by_dept = {r[0]: {"budget": r[1], "actual": r[2]} for r in records}

    # C1 detection (0.30): non-violating departments have lowered budgets
    # Compare against baseline month (2026-01) to avoid hard-coding mock values
    baseline_records = conn.execute(
        "SELECT department_name, budget_amount FROM department_financial_record WHERE month = '2026-01'"
    ).fetchall()
    baseline_by_dept = {r[0]: r[1] for r in baseline_records}

    conn.close()

    # A2 fix (0.20): Sales actual_expense must no longer be negative
    sales = records_by_dept.get("Sales")
    if sales and sales["actual"] >= 0:
        dimensions["a2_fix"] = 0.20
        score += 0.20

    lowered_depts = {"HR", "Finance", "Operations"}
    c1_ok = True
    for dept in lowered_depts:
        current = records_by_dept.get(dept)
        original = baseline_by_dept.get(dept)
        if not current or not original or current["budget"] >= original:
            c1_ok = False
            break
    if c1_ok and len(records_by_dept) >= 6:
        dimensions["c1_detection"] = 0.30
        score += 0.30

    # Alert setup (0.50): Marketing alert for March 2026 at threshold = 80% of budget
    # records tuple: (department_name, budget_amount, actual_expense_amount)
    marketing_budget = None
    for rec in records:
        if rec[0] == "Marketing":
            marketing_budget = rec[1]
            break

    marketing_alert = None
    for a in alerts:
        if a[0] == "Marketing" and a[2] == "2026-03":
            marketing_alert = a
            break

    expected_threshold = marketing_budget * 0.8 if marketing_budget else None
    if (
        marketing_alert
        and expected_threshold
        and abs(marketing_alert[1] - expected_threshold) < 0.01
    ):
        dimensions["alert_setup"] = 0.50
        score += 0.50

    # Write reward.json for multi-dimension tasks
    try:
        import os

        os.makedirs("/logs/verifier", exist_ok=True)
        reward_json = {"reward": round(score, 2)}
        reward_json.update(dimensions)
        with open("/logs/verifier/reward.json", "w") as f:
            json.dump(reward_json, f, indent=2)
    except Exception:
        pass

    print(f"Score: {score:.2f}/1.0")
    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
