#!/usr/bin/env python3
"""
Verifier for finance-anomaly-detect task.

The seed.sql injects 11 transactions:
  - ids 1-7:  normal transactions (should NOT be flagged)
  - id  8:    anomaly — duplicate amount for "Acme Corp" ($12,500.50, same as id 10)
  - id  9:    anomaly — round-number amount ($50,000.00 for "Stark Ind")
  - id  10:   anomaly — duplicate amount for "Acme Corp" ($12,500.50, same as id 8)
  - id  11:   anomaly — round-number amount ($100,000.00 for "Umbrella")

The agent must flag anomalous transactions (ids 8, 9, 10, 11) without flagging
normal ones (ids 1-7).

Scoring:
  - anomaly_detection (0.4): all 4 anomalous transactions flagged
  - no_false_positives (0.3): none of the 7 normal transactions flagged
  - no_false_negatives (0.3): proportional if some anomalies missed

Aggregate score = sum of earned weights.
"""

import json
import os
import sqlite3
import sys
import traceback

DB_PATH = os.environ.get("MOCK_FINANCE_DB_PATH", "/opt/mock/data/finance_app.sqlite")

ANOMALOUS_IDS = {8, 9, 10, 11}
NORMAL_IDS = {1, 2, 3, 4, 5, 6, 7}

WEIGHTS = {
    "anomaly_detection": 0.4,
    "no_false_positives": 0.3,
    "no_false_negatives": 0.3,
}


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
        # Get all transactions
        rows = conn.execute(
            "SELECT id, vendor_name, amount, status FROM transaction_record ORDER BY id"
        ).fetchall()

        if not rows:
            details["messages"].append("ERROR: No transactions found in database")
            return score, details

        flagged_ids = {row["id"] for row in rows if row["status"] == "flagged"}

        details["messages"].append(
            f"Found {len(rows)} transactions, {len(flagged_ids)} flagged: "
            f"{sorted(flagged_ids)}"
        )

        # 1. Anomaly detection: all 4 anomalous transactions must be flagged
        flagged_anomalies = ANOMALOUS_IDS & flagged_ids
        missing_anomalies = ANOMALOUS_IDS - flagged_ids

        # Proportional credit: fraction of anomalies detected
        if ANOMALOUS_IDS:
            anomaly_fraction = len(flagged_anomalies) / len(ANOMALOUS_IDS)
        else:
            anomaly_fraction = 0.0

        earned_weight = WEIGHTS["anomaly_detection"] * anomaly_fraction
        if anomaly_fraction >= 1.0:
            details["dimension_scores"]["anomaly_detection"] = WEIGHTS[
                "anomaly_detection"
            ]
            details["messages"].append(
                f"PASS: All {len(ANOMALOUS_IDS)} anomalous transactions flagged "
                f"({sorted(ANOMALOUS_IDS)})"
            )
        else:
            details["dimension_scores"]["anomaly_detection"] = round(earned_weight, 4)
            details["messages"].append(
                f"PARTIAL: {len(flagged_anomalies)}/{len(ANOMALOUS_IDS)} "
                f"anomalous transactions flagged. Missing: {sorted(missing_anomalies)}"
            )
        score += earned_weight

        # 2. No false positives: none of the normal transactions should be flagged.
        # If the agent flagged nothing at all, they made no detection attempt —
        # this dimension must not award free credit.
        if not flagged_ids:
            details["dimension_scores"]["no_false_positives"] = 0.0
            details["messages"].append(
                "FAIL: No transactions flagged — no_false_positives not evaluated "
                "(agent made no detection attempt)"
            )
        else:
            false_positives = NORMAL_IDS & flagged_ids
            score += record_score(
                details,
                "no_false_positives",
                len(false_positives) == 0,
                "No false positives — normal transactions untouched",
                f"False positives: normal transactions incorrectly flagged: "
                f"{sorted(false_positives)}",
            )

        # 3. No false negatives (full credit handled above in anomaly_detection,
        #    but this dimension specifically tracks completeness)
        if missing_anomalies:
            details["dimension_scores"]["no_false_negatives"] = 0.0
            details["messages"].append(
                f"FAIL: False negatives — anomalies not flagged: "
                f"{sorted(missing_anomalies)}"
            )
        else:
            details["dimension_scores"]["no_false_negatives"] = WEIGHTS[
                "no_false_negatives"
            ]
            details["messages"].append(
                "PASS: No false negatives — all anomalies flagged"
            )
            score += WEIGHTS["no_false_negatives"]

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
