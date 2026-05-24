#!/usr/bin/env python3
"""Verifier for public-archive-timeline-rebuild.

Checks:
  C1: File exists, has header with correct columns
  C2: Exactly 8 data rows (2 policy changes x 4 releases)
  C3: All rows have valid version, date, source_url format
  C4: Dates in chronological order
  C5: No decoy keywords present (product/UI changes excluded)
  C6: At least one policy change from each of the 4 release versions

Scoring:
  6 passes -> 1.0
  3-5 passes -> 0.5
  0-2 passes -> 0.0
  File missing -> 0.0 (exit 1)
"""

import csv
import json
import sys
from datetime import date as date_type
from pathlib import Path

WORKSPACE = Path("/home/node/.openclaw/workspace")
CSV_PATH = WORKSPACE / "policy_timeline.csv"
LOG_DIR = Path("/logs/verifier")
REQUIRED_COLS = {"date", "version", "change", "source_url"}
VALID_VERSIONS = {"v4.0.0", "v4.1.0", "v4.2.0", "v4.3.0"}
DECOY_KEYWORDS = [
    "dashboard",
    "dark mode",
    "search performance",
    "indexing engine",
    "onboarding",
    "mobile app",
    "ios",
    "android",
    "notification",
    "ui overhaul",
    "component system",
    "design language",
    "database migration",
    "mysql",
    "postgresql",
    "lazy loading",
    "code splitting",
    "crash",
    "file upload",
    "text overflow",
    "timezone",
]
POLICY_ANCHORS = {
    "v4.3.0": ["data retention", "cookie consent"],
    "v4.2.0": ["api rate", "export"],
    "v4.1.0": ["two-factor", "password"],
    "v4.0.0": ["terms of service", "privacy shield"],
}


def check_file() -> tuple[bool, str, list[dict]]:
    """C1: File exists with correct columns. Returns (ok, msg, rows)."""
    if not CSV_PATH.exists():
        return False, "policy_timeline.csv not found", []
    if CSV_PATH.stat().st_size == 0:
        return False, "policy_timeline.csv is empty", []

    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            return False, "policy_timeline.csv: no header", []

        cols = set(reader.fieldnames)
        missing = REQUIRED_COLS - cols
        if missing:
            return False, f"policy_timeline.csv: missing columns {missing}", []

        rows = list(reader)
    return True, "ok", rows


def check_row_count(rows: list[dict]) -> tuple[bool, str]:
    """C2: Exactly 8 data rows."""
    n = len(rows)
    if n != 8:
        return False, f"expected 8 rows, got {n}"
    return True, "8 rows"


def check_row_validity(rows: list[dict]) -> tuple[bool, str]:
    """C3: All rows have valid version, date, source_url."""
    bad_rows = []
    for i, row in enumerate(rows):
        row_num = i + 2
        version = row.get("version", "").strip()
        date_str = row.get("date", "").strip()
        url = row.get("source_url", "").strip()

        if version not in VALID_VERSIONS:
            bad_rows.append(f"row {row_num}: invalid version '{version}'")
        try:
            date_type.fromisoformat(date_str)
        except (ValueError, TypeError):
            bad_rows.append(f"row {row_num}: invalid date '{date_str}'")
        if not url.startswith("http://localhost:8400/releases/"):
            bad_rows.append(f"row {row_num}: invalid source_url '{url}'")

    if bad_rows:
        return False, "; ".join(bad_rows[:5])
    return True, "all rows valid"


def check_chronological(rows: list[dict]) -> tuple[bool, str]:
    """C4: Dates in chronological order (oldest to newest)."""
    dates = []
    for i, row in enumerate(rows):
        try:
            dates.append(date_type.fromisoformat(row.get("date", "").strip()))
        except (ValueError, TypeError):
            return False, f"row {i + 2}: unparseable date"
    for j in range(1, len(dates)):
        if dates[j] < dates[j - 1]:
            return False, f"rows not chronological: {dates[j]} before {dates[j - 1]}"
    return True, "chronological"


def check_no_decoys(rows: list[dict]) -> tuple[bool, str]:
    """C5: No decoy keywords in change column."""
    found = []
    for i, row in enumerate(rows):
        change = row.get("change", "").lower()
        for kw in DECOY_KEYWORDS:
            if kw in change:
                found.append(f"row {i + 2}: decoy '{kw}'")
                break
    if found:
        return False, "; ".join(found[:5])
    return True, "no decoy content"


def check_policy_coverage(rows: list[dict]) -> tuple[bool, str]:
    """C6: At least one policy anchor per release version present."""
    content_by_version = {v: [] for v in VALID_VERSIONS}
    for row in rows:
        v = row.get("version", "").strip()
        c = row.get("change", "").lower()
        if v in content_by_version:
            content_by_version[v].append(c)

    missing = []
    for ver, anchors in POLICY_ANCHORS.items():
        combined = " ".join(content_by_version[ver])
        if not any(a in combined for a in anchors):
            missing.append(f"{ver}: missing expected policy anchor")
    if missing:
        return False, "; ".join(missing)
    return True, "all policy anchors covered"


def main():
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    checks = [
        ("C1", lambda: check_file()),
        ("C2", lambda r: check_row_count(r)),
        ("C3", lambda r: check_row_validity(r)),
        ("C4", lambda r: check_chronological(r)),
        ("C5", lambda r: check_no_decoys(r)),
        ("C6", lambda r: check_policy_coverage(r)),
    ]

    scores = {}
    rows = []

    c1_name, c1_fn = checks[0]
    c1_ok, c1_msg, rows = c1_fn()
    scores[c1_name] = c1_ok
    print(f"{c1_name}: {'PASS' if c1_ok else 'FAIL'} — {c1_msg}")

    if not c1_ok:
        score = 0.0
    else:
        for name, fn in checks[1:]:
            ok, msg = fn(rows)
            scores[name] = ok
            print(f"{name}: {'PASS' if ok else 'FAIL'} — {msg}")

        passed = sum(scores.values())
        if passed == 6:
            score = 1.0
        elif passed >= 3:
            score = 0.5
        else:
            score = 0.0

    print(f"\nScore: {score}/1.0")

    reward_path = LOG_DIR / "reward.txt"
    reward_path.write_text(f"{score}\n")
    reward_json = LOG_DIR / "reward.json"
    reward_data = {"reward": score}
    reward_data["_meta_passed_checks"] = sum(scores.values())
    reward_data["_meta_total_checks"] = 6
    reward_json.write_text(json.dumps(reward_data, indent=2) + "\n")

    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
