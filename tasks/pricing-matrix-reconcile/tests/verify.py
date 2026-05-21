#!/usr/bin/env python3
"""
Verifier for pricing-matrix-reconcile.

Checks /workspace/pricing_matrix.csv:
- All 16 rows present (4 plans × 2 regions × 2 billing cycles)
- Canonical plan_id values used (PLAN_F, PLAN_P, PLAN_B, PLAN_E)
- price, users, storage_gb, api_calls_monthly fields filled correctly
- Scoring: 1.0 all rows fully correct; 0.5 CSV exists but some errors; 0.0 missing/empty
"""

import csv
import sys
from pathlib import Path

WORKSPACE = Path("/home/node/.openclaw/workspace")
OUTPUT_CSV = WORKSPACE / "pricing_matrix.csv"
REWARD_TXT = Path("/logs/verifier/reward.txt")
REWARD_JSON = Path("/logs/verifier/reward.json")

# Ground truth: (plan_id, region, billing_cycle) → expected values
# price is stored as plain string (strip currency symbol and /mo for comparison)
EXPECTED = {
    # US monthly
    ("PLAN_F", "US", "monthly"): {
        "price": "$0/mo",
        "users": "1",
        "storage_gb": "1",
        "api_calls_monthly": "500",
    },
    ("PLAN_P", "US", "monthly"): {
        "price": "$29/mo",
        "users": "5",
        "storage_gb": "10",
        "api_calls_monthly": "5000",
    },
    ("PLAN_B", "US", "monthly"): {
        "price": "$99/mo",
        "users": "20",
        "storage_gb": "50",
        "api_calls_monthly": "25000",
    },
    ("PLAN_E", "US", "monthly"): {
        "price": "$299/mo",
        "users": "Unlimited",
        "storage_gb": "200",
        "api_calls_monthly": "Unlimited",
    },
    # US annual
    ("PLAN_F", "US", "annual"): {
        "price": "$0/mo",
        "users": "1",
        "storage_gb": "1",
        "api_calls_monthly": "500",
    },
    ("PLAN_P", "US", "annual"): {
        "price": "$23/mo",
        "users": "5",
        "storage_gb": "10",
        "api_calls_monthly": "5000",
    },
    ("PLAN_B", "US", "annual"): {
        "price": "$79/mo",
        "users": "20",
        "storage_gb": "50",
        "api_calls_monthly": "25000",
    },
    ("PLAN_E", "US", "annual"): {
        "price": "$239/mo",
        "users": "Unlimited",
        "storage_gb": "200",
        "api_calls_monthly": "Unlimited",
    },
    # EU monthly
    ("PLAN_F", "EU", "monthly"): {
        "price": "€0/mo",
        "users": "1",
        "storage_gb": "1",
        "api_calls_monthly": "500",
    },
    ("PLAN_P", "EU", "monthly"): {
        "price": "€27/mo",
        "users": "5",
        "storage_gb": "10",
        "api_calls_monthly": "5000",
    },
    ("PLAN_B", "EU", "monthly"): {
        "price": "€91/mo",
        "users": "20",
        "storage_gb": "50",
        "api_calls_monthly": "25000",
    },
    ("PLAN_E", "EU", "monthly"): {
        "price": "€275/mo",
        "users": "Unlimited",
        "storage_gb": "200",
        "api_calls_monthly": "Unlimited",
    },
    # EU annual
    ("PLAN_F", "EU", "annual"): {
        "price": "€0/mo",
        "users": "1",
        "storage_gb": "1",
        "api_calls_monthly": "500",
    },
    ("PLAN_P", "EU", "annual"): {
        "price": "€21/mo",
        "users": "5",
        "storage_gb": "10",
        "api_calls_monthly": "5000",
    },
    ("PLAN_B", "EU", "annual"): {
        "price": "€73/mo",
        "users": "20",
        "storage_gb": "50",
        "api_calls_monthly": "25000",
    },
    ("PLAN_E", "EU", "annual"): {
        "price": "€220/mo",
        "users": "Unlimited",
        "storage_gb": "200",
        "api_calls_monthly": "Unlimited",
    },
}

VALID_PLAN_IDS = {"PLAN_F", "PLAN_P", "PLAN_B", "PLAN_E"}


def normalise_price(raw: str) -> str:
    """Allow minor formatting variants: '$29', '$29/mo', '$29/month' all accepted."""
    s = raw.strip()
    if not s:
        return s
    # Strip trailing /mo or /month
    for suffix in ("/month", "/mo"):
        if s.endswith(suffix):
            s = s[: -len(suffix)]
    return s


def normalise_api(raw: str) -> str:
    """Allow '5,000' or '5000'; 'Unlimited' case-insensitive."""
    s = raw.strip().replace(",", "")
    if s.lower() == "unlimited":
        return "Unlimited"
    return s


def normalise_users(raw: str) -> str:
    s = raw.strip()
    # Accept '1', '5 users', 'Unlimited users', 'Unlimited'
    for suffix in (" users", " user"):
        if s.endswith(suffix):
            s = s[: -len(suffix)]
    if s.lower() == "unlimited":
        return "Unlimited"
    return s


def normalise_storage(raw: str) -> str:
    s = raw.strip()
    # Accept '1', '1 GB', '1GB'
    for suffix in (" GB", " gb", "GB", "gb"):
        if s.upper().endswith("GB"):
            s = s.rstrip("BbGg").strip()
    return s.strip()


def check_field(key: tuple, field: str, actual: str, expected: str) -> bool:
    a = actual.strip()
    if not a:
        return False
    if field == "price":
        # Compare without /mo suffix, keep currency symbol
        expected_base = normalise_price(expected)
        actual_base = normalise_price(a)
        return actual_base == expected_base
    if field == "users":
        return normalise_users(a) == normalise_users(expected)
    if field == "storage_gb":
        return normalise_storage(a) == normalise_storage(expected)
    if field == "api_calls_monthly":
        return normalise_api(a) == normalise_api(expected)
    return False


def main() -> None:
    import json

    if not OUTPUT_CSV.exists():
        score = 0.0
        errors = ["pricing_matrix.csv not found in /workspace/"]
        REWARD_TXT.write_text("0.0\n")
        REWARD_JSON.write_text(json.dumps({"reward": score, "_meta_errors": errors}))
        print(f"Score: {score}/1.0")
        sys.exit(1)

    rows = []
    try:
        with OUTPUT_CSV.open(encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                rows.append({k.strip(): v.strip() for k, v in row.items()})
    except Exception as exc:
        score = 0.0
        REWARD_TXT.write_text("0.0\n")
        REWARD_JSON.write_text(
            json.dumps({"reward": score, "_meta_errors": [str(exc)]})
        )
        print(f"Score: {score}/1.0")
        sys.exit(1)

    if not rows:
        REWARD_TXT.write_text("0.0\n")
        REWARD_JSON.write_text(
            json.dumps({"reward": 0.0, "_meta_errors": ["CSV is empty"]})
        )
        print("Score: 0.0/1.0")
        sys.exit(1)

    # Index rows by (plan_id, region, billing_cycle)
    indexed: dict = {}
    wrong_plan_id = False
    for row in rows:
        pid = row.get("plan_id", "").strip()
        region = row.get("region", "").strip()
        cycle = row.get("billing_cycle", "").strip()
        if pid and pid not in VALID_PLAN_IDS:
            wrong_plan_id = True
        key = (pid, region, cycle)
        indexed[key] = row

    total_rows = len(EXPECTED)
    correct_rows = 0
    field_errors: list[str] = []

    for key, exp in EXPECTED.items():
        row = indexed.get(key)
        if row is None:
            field_errors.append(
                f"Missing row: plan_id={key[0]} region={key[1]} billing_cycle={key[2]}"
            )
            continue
        row_ok = True
        for field, expected_val in exp.items():
            actual_val = row.get(field, "")
            if not check_field(key, field, actual_val, expected_val):
                row_ok = False
                field_errors.append(
                    f"Row {key}: field '{field}' expected '{expected_val}' got '{actual_val}'"
                )
        if row_ok:
            correct_rows += 1

    if wrong_plan_id:
        field_errors.insert(
            0, "Non-canonical plan_id found — must use PLAN_F/PLAN_P/PLAN_B/PLAN_E"
        )

    ratio = correct_rows / total_rows
    if ratio == 1.0:
        score = 1.0
    elif ratio > 0:
        score = 0.5
    else:
        score = 0.0

    REWARD_TXT.write_text(f"{score}\n")
    REWARD_JSON.write_text(
        json.dumps(
            {
                "reward": score,
                "correct_rows": correct_rows,
                "total_rows": total_rows,
                "_meta_errors": field_errors,
            }
        )
    )
    print(f"Score: {score}/1.0  ({correct_rows}/{total_rows} rows correct)")
    if field_errors:
        for err in field_errors[:10]:
            print(f"  - {err}")
    if score < 0.5:
        sys.exit(1)


if __name__ == "__main__":
    main()
