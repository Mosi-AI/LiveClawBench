#!/usr/bin/env python3
import json
import sys
from pathlib import Path

WORKSPACE_CSV = Path("/home/node/.openclaw/workspace/pressroom.csv")
LOGS_DIR = Path("/logs/verifier")
ARCHIVED_TITLE = "Helix Technologies Data Center Expansion"
REQUIRED_COLS = {"canonical_company", "title", "date", "url", "matched_alias"}


def write_reward(score: float, checks_passed: int, meta: str) -> None:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    (LOGS_DIR / "reward.txt").write_text(str(score))
    (LOGS_DIR / "reward.json").write_text(
        json.dumps(
            {
                "reward": score,
                "checks_passed": checks_passed,
                "_meta_check_details": meta,
            }
        )
    )


def main() -> int:
    if not WORKSPACE_CSV.exists():
        print("Score: 0.0/1.0 (file missing)")
        write_reward(0.0, 0, "file_missing")
        return 1

    try:
        import pandas as pd
    except ImportError:
        print("Score: 0.0/1.0 (pandas not available)")
        write_reward(0.0, 0, "pandas_import_error")
        return 1

    df = pd.read_csv(WORKSPACE_CSV)
    df = df.map(lambda x: x.strip() if isinstance(x, str) else x)

    # C6 first: required columns present
    c6 = REQUIRED_COLS.issubset(set(df.columns))

    # C1: exactly 6 rows
    c1 = len(df) == 6

    # C2: canonical_company == "Helix Corp" for all rows (guarded by C6)
    c2 = bool((df["canonical_company"] == "Helix Corp").all()) if "canonical_company" in df.columns else False

    # C3: archived title not in output (guarded by C6)
    c3 = ARCHIVED_TITLE not in df["title"].values if "title" in df.columns else False

    # C4: no duplicate titles (guarded by C6)
    c4 = df["title"].nunique() == len(df) if "title" in df.columns else False

    # C5: rows date-descending (guarded by C6)
    if "date" in df.columns:
        dates = pd.to_datetime(df["date"], errors="coerce")
        c5 = bool(dates.is_monotonic_decreasing)
    else:
        c5 = False

    checks_passed = sum([c6, c1, c2, c3, c4, c5])

    if checks_passed == 6:
        score = 1.0
    elif checks_passed >= 1:
        score = 0.5
    else:
        score = 0.0

    print(f"Score: {score}/1.0")
    print(f"Checks passed: {checks_passed}/6 (C6={c6}, C1={c1}, C2={c2}, C3={c3}, C4={c4}, C5={c5})")
    write_reward(score, checks_passed, "C1-C6")

    return 0 if score >= 0.5 else 1


if __name__ == "__main__":
    sys.exit(main())
