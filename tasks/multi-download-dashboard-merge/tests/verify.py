"""Verifier for multi-download-dashboard-merge task.

Checks that the agent produced a correctly merged daily_merge.csv
with canonical column names, refreshed in-range rows, and preserved
out-of-range rows.
"""

import csv
import os
import sys

WORKSPACE_FILE = "/home/node/.openclaw/workspace/daily_merge.csv"
LOGS_DIR = "/logs/verifier"

CANONICAL_COLS = [
    "date",
    "traffic_visits",
    "traffic_uniques",
    "conversion_leads",
    "conversion_signups",
    "spend_amount",
    "spend_clicks",
]

LEGACY_COLS = {
    "Day",
    "Date",
    "report_date",
    "Visits",
    "Unique Visitors",
    "Leads",
    "Signups",
    "Ad Spend",
    "Clicks",
}

TARGET_DATES = {"2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05"}

STALE_2026_04_02 = ("999", "888", "10", "5", "300.00", "200")

EXPECTED_2026_04_02 = {
    "traffic_visits": "1487",
    "traffic_uniques": "1156",
    "conversion_leads": "52",
    "conversion_signups": "38",
    "spend_amount": "1180.50",
    "spend_clicks": "845",
}

SEED_OUT_OF_RANGE = {
    "2026-03-30": {
        "traffic_visits": "1000",
        "traffic_uniques": "800",
        "conversion_leads": "20",
        "conversion_signups": "15",
        "spend_amount": "500.00",
        "spend_clicks": "400",
    },
    "2026-04-10": {
        "traffic_visits": "2000",
        "traffic_uniques": "1600",
        "conversion_leads": "60",
        "conversion_signups": "45",
        "spend_amount": "1500.00",
        "spend_clicks": "1100",
    },
}


def main():
    os.makedirs(LOGS_DIR, exist_ok=True)

    results = {}
    checks_passed = 0

    # C1: File exists
    if not os.path.isfile(WORKSPACE_FILE):
        _write_reward(0.0, 0, "C1:file_missing")
        sys.exit(1)
    results["C1"] = True
    checks_passed += 1

    # Read CSV
    with open(WORKSPACE_FILE, "r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        rows = list(reader)

    if len(rows) < 2:
        _write_reward(0.0, 1, "C1:file_missing C2-C6:fail")
        sys.exit(1)

    header = rows[0]
    data_rows = rows[1:]

    # Re-read as dicts for value checks
    with open(WORKSPACE_FILE, "r", encoding="utf-8", newline="") as f:
        dict_reader = csv.DictReader(f)
        dict_rows = list(dict_reader)

    # C2: Row count (exactly 7 data rows)
    if len(data_rows) == 7:
        results["C2"] = True
        checks_passed += 1
    else:
        results["C2"] = False

    # C3: Canonical columns
    header_set = set(header)
    canonical_set = set(CANONICAL_COLS)
    legacy_in_header = LEGACY_COLS & header_set
    if header_set == canonical_set and not legacy_in_header:
        results["C3"] = True
        checks_passed += 1
    else:
        results["C3"] = False

    # Build dict by date (only if header looks canonical)
    rows_by_date = {}
    if results["C3"]:
        for dr in dict_rows:
            rows_by_date[dr.get("date", "")] = dr

    # C4: Stale overwrite — 2026-04-02 row must NOT contain stale values
    c4_ok = False
    if "2026-04-02" in rows_by_date:
        r = rows_by_date["2026-04-02"]
        for col in CANONICAL_COLS[1:]:  # skip 'date'
            if r.get(col) not in ("", None):
                c4_ok = True
                break
        # Check NOT stale
        if c4_ok:
            vals = tuple(r.get(col, "") for col in CANONICAL_COLS[1:])
            if vals != STALE_2026_04_02:
                results["C4"] = True
                checks_passed += 1
            else:
                results["C4"] = False
        else:
            results["C4"] = False
    else:
        results["C4"] = False

    # C5: Range integrity — out-of-range rows preserved + >=4 in-range dates
    c5_out_ok = True
    for date_str, expected in SEED_OUT_OF_RANGE.items():
        if date_str not in rows_by_date:
            c5_out_ok = False
            break
        r = rows_by_date[date_str]
        for col, val in expected.items():
            if r.get(col, "").strip() != val:
                c5_out_ok = False
                break

    # Count in-range dates
    in_range_dates = TARGET_DATES & set(rows_by_date.keys())
    c5_in_range_ok = len(in_range_dates) >= 4

    if c5_out_ok and c5_in_range_ok:
        results["C5"] = True
        checks_passed += 1
    else:
        results["C5"] = False

    # C6: Merge completeness — all 5 dates with non-empty metrics
    c6_ok = True
    for d in TARGET_DATES:
        if d not in rows_by_date:
            c6_ok = False
            break
        r = rows_by_date[d]
        for col in CANONICAL_COLS[1:]:
            if r.get(col, "").strip() == "":
                c6_ok = False
                break
        if not c6_ok:
            break
    if c6_ok:
        results["C6"] = True
        checks_passed += 1
    else:
        results["C6"] = False

    # Scoring
    if checks_passed == 6:
        score = 1.0
    elif checks_passed >= 3:
        score = 0.5
    else:
        score = 0.0

    check_details = " ".join(
        f"C{int(k[1])}:{'pass' if v else 'fail'}" for k, v in sorted(results.items())
    )
    _write_reward(score, checks_passed, check_details)

    sys.exit(0 if score >= 0.5 else 1)


def _write_reward(score, checks_passed, details):
    os.makedirs(LOGS_DIR, exist_ok=True)

    reward_txt = os.path.join(LOGS_DIR, "reward.txt")
    with open(reward_txt, "w") as f:
        f.write(str(score))

    import json

    reward_json = os.path.join(LOGS_DIR, "reward.json")
    with open(reward_json, "w") as f:
        json.dump(
            {
                "reward": score,
                "checks_passed": checks_passed,
                "_meta_check_details": details,
            },
            f,
        )


if __name__ == "__main__":
    main()
