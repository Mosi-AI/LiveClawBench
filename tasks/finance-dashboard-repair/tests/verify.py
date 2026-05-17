#!/usr/bin/env python3
"""Verifier for finance-dashboard-repair task.

Hard task (a2+b2) with dimension scoring.
Checks:
  - formula_parseable: Formula JSON is valid (0.15)
  - no_deprecated: No deprecated v1 field names (0.2)
  - valid_fields: All field names are valid v2 names (0.2)
  - formula_structure: Formula matches NAPI definition (0.15)
  - policy_audit: Policy file has audit notes (0.15)
  - policy_content: Policy mentions specific corrections (0.15)
"""
import json
import os
import sqlite3
import sys
import traceback

DB_PATH = os.environ.get("MOCK_FINANCE_DB_PATH", "/opt/mock/data/finance_app.sqlite")
POLICY_PATH = "/workspace/policies/dashboard_spec.md"

DEPRECATED_FIELDS = {"total_expenses", "budget_deviation", "gross_revenue"}
VALID_FIELDS = {"budget_amount", "actual_expense_amount", "revenue_amount"}

WEIGHTS = {
    "formula_parseable": 0.15,
    "no_deprecated": 0.2,
    "valid_fields": 0.2,
    "formula_structure": 0.15,
    "policy_audit": 0.15,
    "policy_content": 0.15,
}


def collect_field_names(node, fields):
    if isinstance(node, dict):
        if node.get("op") == "field" and "name" in node:
            fields.add(node["name"])
        for v in node.values():
            if isinstance(v, dict):
                collect_field_names(v, fields)
            elif isinstance(v, list):
                for item in v:
                    collect_field_names(item, fields)


def main():
    dimension_scores = {}
    messages = []

    # Read dashboard config from DB
    db = sqlite3.connect(DB_PATH)
    row = db.execute(
        "SELECT formula_json FROM dashboard_config WHERE user_id = 1"
    ).fetchone()
    db.close()

    if not row:
        print("Score: 0.0/1.0 | No dashboard config found for admin user")
        write_reward(0.0, dimension_scores)
        sys.exit(1)

    formula_str = row[0]
    score = 0.0

    # --- Dimension 1: Formula is valid JSON (0.15) ---
    try:
        formula = json.loads(formula_str)
        score += WEIGHTS["formula_parseable"]
        dimension_scores["formula_parseable"] = WEIGHTS["formula_parseable"]
        messages.append("PASS: formula_json is valid JSON")
    except json.JSONDecodeError:
        dimension_scores["formula_parseable"] = 0.0
        messages.append("FAIL: formula_json is not valid JSON")
        print("Score: 0.0/1.0 | " + "; ".join(messages))
        write_reward(0.0, dimension_scores)
        sys.exit(1)

    # --- Dimension 2: No deprecated field names (0.2) ---
    formula_text = formula_str.lower()
    deprecated_found = [d for d in DEPRECATED_FIELDS if d in formula_text]
    if not deprecated_found:
        score += WEIGHTS["no_deprecated"]
        dimension_scores["no_deprecated"] = WEIGHTS["no_deprecated"]
        messages.append("PASS: no deprecated field names")
    else:
        dimension_scores["no_deprecated"] = 0.0
        messages.append(f"FAIL: deprecated fields still present: {deprecated_found}")

    # --- Dimension 3: Formula uses correct v2 field names (0.2) ---
    field_names = set()
    collect_field_names(formula, field_names)
    uses_valid = field_names <= VALID_FIELDS and len(field_names) > 0
    if uses_valid:
        score += WEIGHTS["valid_fields"]
        dimension_scores["valid_fields"] = WEIGHTS["valid_fields"]
        messages.append("PASS: all field names are valid v2 names")
    else:
        invalid = field_names - VALID_FIELDS
        dimension_scores["valid_fields"] = 0.0
        messages.append(f"FAIL: invalid field names: {invalid}")

    # --- Dimension 4: Formula matches NAPI structure (0.15) ---
    has_correct_consts = "0.1" in formula_str and "0.05" in formula_str
    has_add = '"op":"add"' in formula_str
    has_subtract = '"op":"subtract"' in formula_str
    has_multiply = '"op":"multiply"' in formula_str
    has_revenue = '"revenue_amount"' in formula_str
    has_expense = '"actual_expense_amount"' in formula_str
    has_budget = '"budget_amount"' in formula_str

    structure_score = 0.0
    if has_correct_consts:
        structure_score += 0.05
    if has_add and has_subtract and has_multiply:
        structure_score += 0.05
    if has_revenue and has_expense and has_budget:
        structure_score += 0.05
    dimension_scores["formula_structure"] = structure_score
    score += structure_score
    if structure_score >= WEIGHTS["formula_structure"]:
        messages.append("PASS: formula matches NAPI structure")
    else:
        messages.append(f"FAIL: formula structure partial match ({structure_score:.2f}/{WEIGHTS['formula_structure']:.2f})")

    # --- Dimension 5: Policy file has audit notes (0.15) ---
    policy_content = ""
    try:
        with open(POLICY_PATH, "r") as f:
            policy_content = f.read().lower()
    except FileNotFoundError:
        messages.append("FAIL: policy file not found")

    has_audit = any(
        kw in policy_content
        for kw in ["audit", "correction", "fixed", "repaired", "issue", "error"]
    )
    if has_audit:
        score += WEIGHTS["policy_audit"]
        dimension_scores["policy_audit"] = WEIGHTS["policy_audit"]
        messages.append("PASS: policy has audit notes")
    else:
        dimension_scores["policy_audit"] = 0.0
        messages.append("FAIL: policy missing audit/correction notes")

    # --- Dimension 6: Policy mentions specific corrections (0.15) ---
    mentions_expense = "actual_expense_amount" in policy_content
    mentions_budget = "budget_amount" in policy_content
    mentions_deprecated_context = (
        "total_expenses" in policy_content
        and ("deprecated" in policy_content or "replace" in policy_content or "correct" in policy_content)
    )

    policy_content_score = 0.0
    if mentions_expense:
        policy_content_score += 0.05
    if mentions_budget:
        policy_content_score += 0.05
    if mentions_deprecated_context:
        policy_content_score += 0.05
    dimension_scores["policy_content"] = policy_content_score
    score += policy_content_score
    if policy_content_score >= WEIGHTS["policy_content"]:
        messages.append("PASS: policy mentions specific corrections")
    else:
        messages.append(f"FAIL: policy content partial ({policy_content_score:.2f}/{WEIGHTS['policy_content']:.2f})")

    # Compute total
    total = round(min(score, 1.0), 2)
    score_line = f"Score: {total:.1f}/1.0 | " + "; ".join(messages)
    print(score_line)

    write_reward(total, dimension_scores)

    if total < 0.5:
        sys.exit(1)


def write_reward(total, dimension_scores):
    os.makedirs("/logs/verifier", exist_ok=True)
    reward_json = {f"_meta_{k}": v for k, v in dimension_scores.items()}
    reward_json["reward"] = total
    with open("/logs/verifier/reward.json", "w") as f:
        json.dump(reward_json, f, indent=2)


if __name__ == "__main__":
    main()
