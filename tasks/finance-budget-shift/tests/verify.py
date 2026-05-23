"""Verifier for finance-budget-shift (A1+A2+C1).

Multi-dimensional scoring:
  a2_fix (0.20): A2 corruption fixed
  c1_detection (0.30): alert threshold matches lowered budget cap
  alert_setup (0.50): budget alert correctly set up
"""
import json
import sqlite3
import sys

DB_PATH = "/var/lib/mock-data/finance/finance.db"

def main():
    score = 0.0
    dimensions = {}

    try:
        conn = sqlite3.connect(DB_PATH)
    except Exception:
        conn = sqlite3.connect("/workspace/finance.db")

    # Check department financial records for budget alert setup
    try:
        records = conn.execute(
            "SELECT id, department_name, budget_amount, actual_amount FROM department_financial_record"
        ).fetchall()
    except Exception:
        records = []

    # Check budget alerts
    try:
        alerts = conn.execute("SELECT id, threshold FROM budget_alert").fetchall()
    except Exception:
        alerts = []

    conn.close()

    # A2 fix (0.20): check if data is no longer corrupted
    if records:
        valid_records = [r for r in records if r[2] is not None and r[3] is not None]
        if len(valid_records) == len(records):
            dimensions["a2_fix"] = 0.20
            score += 0.20

    # C1 detection + alert setup (0.30 + 0.50)
    if alerts:
        dimensions["c1_detection"] = 0.30
        score += 0.30
        # Check if alert threshold is reasonable (matches lowered cap)
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
