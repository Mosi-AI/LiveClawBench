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

DB_PATH = os.environ.get("MOCK_FINANCE_DB_PATH", "/opt/mock/data/finance_app.sqlite")
POLICY_PATH = os.environ.get("POLICY_PATH", "/workspace/policies/dashboard_spec.md")

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


def write_reward(total: float, dimension_scores: dict) -> None:
    try:
        os.makedirs("/logs/verifier", exist_ok=True)
        reward_json = {f"_meta_{k}": v for k, v in dimension_scores.items()}
        reward_json["reward"] = total
        with open("/logs/verifier/reward.json", "w") as f:
            json.dump(reward_json, f, indent=2)
    except OSError:
        pass


def main() -> None:
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

    # Detect seed state: if the broken seed formula's deprecated fields are still
    # present, the agent has not modified the formula at all.
    SEED_DEPRECATED_SIGNATURES = ["total_expenses", "budget_deviation"]
    is_seed_state = any(sig in formula_str for sig in SEED_DEPRECATED_SIGNATURES)

    # --- Dimension 1: Formula is valid JSON (0.15) ---
    try:
        formula = json.loads(formula_str)
        if is_seed_state:
            dimension_scores["formula_parseable"] = 0.0
            messages.append("FAIL: formula_json is unchanged from seed state")
        else:
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
    if is_seed_state:
        dimension_scores["formula_structure"] = 0.0
        messages.append(
            "FAIL: formula structure not evaluated — formula still in seed state"
        )
    else:
        formula_compact = json.dumps(formula, separators=(",", ":"))
        has_correct_consts = "0.1" in formula_compact and "0.05" in formula_compact
        has_add = '"op":"add"' in formula_compact
        has_subtract = '"op":"subtract"' in formula_compact
        has_multiply = '"op":"multiply"' in formula_compact
        has_revenue = '"revenue_amount"' in formula_compact
        has_expense = '"actual_expense_amount"' in formula_compact
        has_budget = '"budget_amount"' in formula_compact

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
            messages.append(
                f"FAIL: formula structure partial match ({structure_score:.2f}/{WEIGHTS['formula_structure']:.2f})"
            )

    # --- Dimension 5: Policy file has audit notes (0.15) ---
    policy_content = ""
    try:
        with open(POLICY_PATH, "r") as f:
            policy_content = f.read().lower()
    except FileNotFoundError:
        messages.append("FAIL: policy file not found")

    has_audit_section = any(
        header in policy_content
        for header in [
            "## audit",
            "## change log",
            "## correction log",
            "## change record",
        ]
    )
    if has_audit_section:
        score += WEIGHTS["policy_audit"]
        dimension_scores["policy_audit"] = WEIGHTS["policy_audit"]
        messages.append("PASS: policy has audit notes section")
    else:
        dimension_scores["policy_audit"] = 0.0
        messages.append(
            "FAIL: policy missing audit notes section (## Audit or similar)"
        )

    # --- Dimension 6: Policy mentions specific corrections (0.15) ---
    # Only check if audit section exists; initial spec must not satisfy this.
    policy_content_score = 0.0
    if has_audit_section:
        mentions_expense_fix = (
            "total_expenses" in policy_content
            and "actual_expense_amount" in policy_content
            and (
                "replace" in policy_content
                or "correct" in policy_content
                or "fix" in policy_content
            )
        )
        mentions_budget_fix = (
            "budget_deviation" in policy_content
            and "budget_amount" in policy_content
            and (
                "replace" in policy_content
                or "correct" in policy_content
                or "fix" in policy_content
            )
        )
        if mentions_expense_fix:
            policy_content_score += 0.075
        if mentions_budget_fix:
            policy_content_score += 0.075

    dimension_scores["policy_content"] = policy_content_score
    score += policy_content_score
    if policy_content_score >= WEIGHTS["policy_content"]:
        messages.append("PASS: policy documents specific field corrections")
    else:
        messages.append(
            f"FAIL: policy content partial ({policy_content_score:.3f}/{WEIGHTS['policy_content']:.2f})"
        )

    # Compute total
    total = round(min(score, 1.0), 2)
    score_line = f"Score: {total:.2f}/1.0 | " + "; ".join(messages)
    print(score_line)

    write_reward(total, dimension_scores)

    if total < 0.5:
        sys.exit(1)


if __name__ == "__main__":
    main()
