#!/usr/bin/env python3
"""
Verifier for paginated-directory-shortlist-export.

Checks /workspace/shortlist.csv:
  - File exists
  - Exactly 8 data rows (after header)
  - All vendor_ids are from the valid set {V001-V008}
  - No duplicate vendor_ids
  - All rows satisfy filters: category=Technology, region=North America,
    rating >= 4.0 (per filter_spec.txt), status=Active
  - contact_email and contract_type columns present and non-empty
    (these fields are only available from the detail page)

Ground-truth contact data per vendor_id:
  V001: bd@apexsystems.com         / Enterprise
  V002: partners@brightwave.io     / Standard
  V003: alliances@cloudnine.co     / Premium
  V004: sales@dataforge.com        / Standard
  V005: partnerships@edgepoint.ai  / Standard
  V006: enterprise@flowstate.dev   / Enterprise
  V007: biz@gridmind.com           / Premium
  V008: connect@helixdata.io       / Standard

Scoring:
  1.0 — all checks pass
  0.5 — CSV exists but wrong row count, duplicate vendor_ids, or missing detail fields
  0.0 — CSV missing
"""

import csv
import json
import sys
from pathlib import Path

SHORTLIST = Path("/home/node/.openclaw/workspace/shortlist.csv")
REWARD_TXT = Path("/logs/verifier/reward.txt")
REWARD_JSON = Path("/logs/verifier/reward.json")

VALID_VENDOR_IDS = {"V001", "V002", "V003", "V004", "V005", "V006", "V007", "V008"}
MIN_RATING = 4.0

GROUND_TRUTH = {
    "V001": {"contact_email": "bd@apexsystems.com", "contract_type": "Enterprise"},
    "V002": {
        "contact_email": "partners@brightwave.io",
        "contract_type": "Standard",
    },
    "V003": {"contact_email": "alliances@cloudnine.co", "contract_type": "Premium"},
    "V004": {"contact_email": "sales@dataforge.com", "contract_type": "Standard"},
    "V005": {
        "contact_email": "partnerships@edgepoint.ai",
        "contract_type": "Standard",
    },
    "V006": {
        "contact_email": "enterprise@flowstate.dev",
        "contract_type": "Enterprise",
    },
    "V007": {"contact_email": "biz@gridmind.com", "contract_type": "Premium"},
    "V008": {"contact_email": "connect@helixdata.io", "contract_type": "Standard"},
}


def main() -> None:
    passed: list[str] = []

    if not SHORTLIST.exists():
        score = 0.0
        REWARD_TXT.write_text("0.0\n")
        REWARD_JSON.write_text(
            json.dumps(
                {
                    "reward": score,
                    "_meta_errors": ["shortlist.csv not found in workspace/"],
                }
            )
        )
        print("Score: 0.0/1.0")
        sys.exit(1)

    try:
        with SHORTLIST.open(encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            rows = [{k.strip(): v.strip() for k, v in row.items()} for row in reader]
    except Exception as exc:
        score = 0.0
        REWARD_TXT.write_text("0.0\n")
        REWARD_JSON.write_text(
            json.dumps({"reward": score, "_meta_errors": [str(exc)]})
        )
        print(f"Score: 0.0/1.0  (CSV parse error: {exc})")
        sys.exit(1)

    issues: list[str] = []

    # Check row count
    if len(rows) != 8:
        issues.append(f"Expected exactly 8 rows, found {len(rows)}")
    else:
        passed.append("Row count: 8 ✓")

    # Check required columns present
    required_cols = {
        "vendor_id",
        "vendor_name",
        "category",
        "region",
        "rating",
        "status",
        "contact_email",
        "contract_type",
    }
    if rows:
        present = set(rows[0].keys())
        missing_cols = required_cols - present
        if missing_cols:
            issues.append(f"Missing columns: {sorted(missing_cols)}")
        else:
            passed.append("All required columns present ✓")

    # Check duplicate vendor_ids
    seen_ids: list[str] = []
    for row in rows:
        vid = row.get("vendor_id", "").strip()
        if vid in seen_ids:
            issues.append(f"Duplicate vendor_id: {vid}")
        else:
            seen_ids.append(vid)
    if len(seen_ids) == len(rows):
        passed.append("No duplicate vendor_ids ✓")

    # Check all vendor_ids are valid
    invalid_ids = [
        row.get("vendor_id", "")
        for row in rows
        if row.get("vendor_id", "") not in VALID_VENDOR_IDS
    ]
    if invalid_ids:
        issues.append(f"Invalid vendor_ids (not in valid set): {invalid_ids}")
    else:
        passed.append("All vendor_ids valid ✓")

    # Check filter criteria per row
    for row in rows:
        vid = row.get("vendor_id", "?")
        if row.get("category", "").strip() != "Technology":
            issues.append(f"{vid}: category '{row.get('category')}' != 'Technology'")
        if row.get("region", "").strip() != "North America":
            issues.append(f"{vid}: region '{row.get('region')}' != 'North America'")
        if row.get("status", "").strip() != "Active":
            issues.append(f"{vid}: status '{row.get('status')}' != 'Active'")
        try:
            rating = float(row.get("rating", "0"))
            if rating < MIN_RATING:
                issues.append(
                    f"{vid}: rating {rating} < {MIN_RATING} (min_rating from filter_spec.txt)"
                )
        except ValueError:
            issues.append(f"{vid}: non-numeric rating '{row.get('rating')}'")

    if not any(
        "category" in e or "region" in e or "status" in e or "rating" in e
        for e in issues
    ):
        passed.append("All rows satisfy filter criteria ✓")

    # Check contact_email and contract_type are non-empty and match ground truth
    detail_ok = 0
    for row in rows:
        vid = row.get("vendor_id", "")
        email = row.get("contact_email", "").strip()
        ctype = row.get("contract_type", "").strip()
        if not email:
            issues.append(f"{vid}: contact_email is empty (must come from detail page)")
        if not ctype:
            issues.append(f"{vid}: contract_type is empty (must come from detail page)")
        if email and ctype:
            detail_ok += 1
            # Verify values match ground truth if vendor_id is known
            gt = GROUND_TRUTH.get(vid)
            if gt:
                if email != gt["contact_email"]:
                    issues.append(
                        f"{vid}: contact_email '{email}' != expected '{gt['contact_email']}'"
                    )
                if ctype != gt["contract_type"]:
                    issues.append(
                        f"{vid}: contract_type '{ctype}' != expected '{gt['contract_type']}'"
                    )
    if detail_ok == len(rows):
        passed.append("contact_email and contract_type present for all rows ✓")

    # Scoring
    has_row_count_ok = len(rows) == 8
    has_no_dupes = len(seen_ids) == len(rows)
    has_valid_ids = not invalid_ids
    has_detail_fields = detail_ok == len(rows) and len(rows) > 0

    all_ok = (
        has_row_count_ok
        and has_no_dupes
        and has_valid_ids
        and has_detail_fields
        and not issues
    )

    if all_ok:
        score = 1.0
    elif SHORTLIST.exists() and (has_row_count_ok or has_detail_fields or has_no_dupes):
        score = 0.5
    else:
        score = 0.0

    REWARD_TXT.write_text(f"{score}\n")
    REWARD_JSON.write_text(
        json.dumps(
            {
                "reward": score,
                "rows_found": len(rows),
                "rows_expected": 8,
                "detail_fields_ok": detail_ok,
                "_meta_errors": issues,
                "_meta_passed": passed,
            }
        )
    )
    print(
        f"Score: {score}/1.0  "
        f"(rows={len(rows)}/8, detail_ok={detail_ok}/{len(rows)}, issues={len(issues)})"
    )
    for msg in passed:
        print(f"  + {msg}")
    for msg in issues[:10]:
        print(f"  - {msg}")
    if score < 0.5:
        sys.exit(1)


if __name__ == "__main__":
    main()
