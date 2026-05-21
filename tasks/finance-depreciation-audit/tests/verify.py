#!/usr/bin/env python3
"""
Verifier for finance-depreciation-audit task.

Hard task (a2+b1+b2) with dimension scoring.
Checks:
  - db_corrections: Incorrect assets corrected with right values (0.3)
  - no_false_corrections: Correct assets left untouched (0.15)
  - correction_reasons: correction_reason populated for corrected assets (0.15)
  - policy_updated: Asset policy file updated with audit results section (0.2)
  - policy_content: Policy mentions specific corrected assets (0.2)
"""

import json
import os
import sqlite3
import sys
import traceback
from pathlib import Path

DB_PATH = os.environ.get("MOCK_FINANCE_DB_PATH", "/opt/mock/data/finance_app.sqlite")
POLICY_PATH = "/workspace/policies/asset_policy.md"
TOLERANCE = 0.01

WEIGHTS = {
    "db_corrections": 0.3,
    "no_false_corrections": 0.15,
    "correction_reasons": 0.15,
    "policy_updated": 0.2,
    "policy_content": 0.2,
}

# Expected corrections:
# Asset 2 "Laptop Fleet": straight_line, should be (80000-8000)/4 = 18000
# Asset 4 "Company Vehicle": declining_balance, should be 60000*(2/6) = 20000
# Asset 6 "Backup Generator": straight_line, should be (40000-4000)/8 = 4500
EXPECTED_CORRECTIONS = {
    2: {"asset_name": "Laptop Fleet", "expected_depreciation": 18000.0},
    4: {"asset_name": "Company Vehicle", "expected_depreciation": 20000.0},
    6: {"asset_name": "Backup Generator", "expected_depreciation": 4500.0},
}

# Correct assets that should NOT be changed
CORRECT_ASSETS = {1: 9000.0, 3: 2700.0, 5: 4500.0, 7: 2700.0}


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
        # 1. Check corrected assets
        corrected_count = 0
        for asset_id, expected in EXPECTED_CORRECTIONS.items():
            row = conn.execute(
                "SELECT annual_depreciation FROM asset_record WHERE id = ?",
                (asset_id,),
            ).fetchone()
            if (
                row
                and abs(row["annual_depreciation"] - expected["expected_depreciation"])
                <= TOLERANCE
            ):
                corrected_count += 1

        score += record_score(
            details,
            "db_corrections",
            corrected_count == len(EXPECTED_CORRECTIONS),
            f"All {len(EXPECTED_CORRECTIONS)} incorrect assets corrected",
            f"Only {corrected_count}/{len(EXPECTED_CORRECTIONS)} incorrect assets corrected",
        )

        # 2. Check no false corrections (only meaningful if agent attempted corrections)
        if corrected_count == 0:
            details["dimension_scores"]["no_false_corrections"] = 0.0
            details["messages"].append(
                "FAIL: No corrections attempted — no_false_corrections not evaluated"
            )
        else:
            correct_untouched = 0
            for asset_id, expected_dep in CORRECT_ASSETS.items():
                row = conn.execute(
                    "SELECT annual_depreciation FROM asset_record WHERE id = ?",
                    (asset_id,),
                ).fetchone()
                if row and abs(row["annual_depreciation"] - expected_dep) <= TOLERANCE:
                    correct_untouched += 1

            score += record_score(
                details,
                "no_false_corrections",
                correct_untouched == len(CORRECT_ASSETS),
                f"All {len(CORRECT_ASSETS)} correct assets untouched",
                f"Only {correct_untouched}/{len(CORRECT_ASSETS)} correct assets untouched",
            )

        # 3. Check correction reasons
        reasons_count = 0
        for asset_id in EXPECTED_CORRECTIONS:
            row = conn.execute(
                "SELECT correction_reason FROM asset_record WHERE id = ?",
                (asset_id,),
            ).fetchone()
            if row and row["correction_reason"] and row["correction_reason"].strip():
                reasons_count += 1

        score += record_score(
            details,
            "correction_reasons",
            reasons_count == len(EXPECTED_CORRECTIONS),
            "All corrected assets have correction reasons",
            f"Only {reasons_count}/{len(EXPECTED_CORRECTIONS)} corrected assets have reasons",
        )

        # 4. Check policy file updated
        policy_path = Path(POLICY_PATH)
        if policy_path.exists():
            policy_content = policy_path.read_text()
            has_audit_section = "audit result" in policy_content.lower()
            score += record_score(
                details,
                "policy_updated",
                has_audit_section,
                "Policy file updated with audit results section",
                "Policy file missing audit results section",
            )

            # 5. Check policy mentions specific assets
            mentioned = sum(
                1
                for info in EXPECTED_CORRECTIONS.values()
                if info["asset_name"].lower() in policy_content.lower()
            )
            score += record_score(
                details,
                "policy_content",
                mentioned == len(EXPECTED_CORRECTIONS),
                f"Policy mentions all {len(EXPECTED_CORRECTIONS)} corrected assets",
                f"Policy mentions {mentioned}/{len(EXPECTED_CORRECTIONS)} corrected assets",
            )
        else:
            score += record_score(
                details, "policy_updated", False, "", "Policy file not found"
            )
            score += record_score(
                details, "policy_content", False, "", "Policy file not found"
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

    try:
        reward_json = {"reward": round(score, 2)}
        reward_json.update(details["dimension_scores"])
        with open("/logs/verifier/reward.json", "w") as f:
            json.dump(reward_json, f, indent=2)
    except Exception:
        pass

    sys.exit(0 if score >= 0.5 else 1)
