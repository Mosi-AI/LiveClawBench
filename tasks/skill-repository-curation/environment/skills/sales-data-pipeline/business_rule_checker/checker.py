"""Business Rule Checker - Validate business rules: positive values, references, date ranges."""

import argparse
import json
import pandas as pd


def check_positive(df, columns):
    """Check that specified columns contain only positive values."""
    violations = []
    for col in columns:
        if col not in df.columns:
            violations.append(
                {"rule": "positive", "column": col, "issue": "column not found"}
            )
            continue
        neg_count = (df[col] < 0).sum()
        if neg_count > 0:
            violations.append(
                {
                    "rule": "positive",
                    "column": col,
                    "issue": f"{neg_count} negative values",
                }
            )
    return violations


def check_date_range(df, column, min_date=None, max_date=None):
    """Check that date column values fall within a range."""
    violations = []
    if column not in df.columns:
        return [{"rule": "date_range", "column": column, "issue": "column not found"}]
    dates = pd.to_datetime(df[column], errors="coerce")
    if min_date:
        before = (dates < pd.Timestamp(min_date)).sum()
        if before > 0:
            violations.append(
                {
                    "rule": "date_range",
                    "column": column,
                    "issue": f"{before} before {min_date}",
                }
            )
    if max_date:
        after = (dates > pd.Timestamp(max_date)).sum()
        if after > 0:
            violations.append(
                {
                    "rule": "date_range",
                    "column": column,
                    "issue": f"{after} after {max_date}",
                }
            )
    return violations


def check_referential_integrity(df, column, ref_df, ref_column):
    """Check that all values in column exist in the reference column."""
    missing = set(df[column].dropna()) - set(ref_df[ref_column].dropna())
    if missing:
        return [
            {
                "rule": "referential",
                "column": column,
                "issue": f"{len(missing)} orphan values",
            }
        ]
    return []


def main():
    parser = argparse.ArgumentParser(description="Check business rules on data")
    parser.add_argument("-i", "--input", required=True, help="Input parquet file")
    parser.add_argument("-o", "--output", required=True, help="Output report (JSON)")
    parser.add_argument(
        "--positive-cols",
        default=None,
        help="Comma-separated columns that must be positive",
    )
    parser.add_argument("--date-col", default=None, help="Date column to check range")
    parser.add_argument("--min-date", default=None, help="Minimum allowed date")
    parser.add_argument("--max-date", default=None, help="Maximum allowed date")
    parser.add_argument(
        "--ref-file", default=None, help="Reference file for referential integrity"
    )
    parser.add_argument("--ref-col", default=None, help="Column in input to check")
    parser.add_argument(
        "--ref-target-col", default=None, help="Column in reference file"
    )
    args = parser.parse_args()

    df = pd.read_parquet(args.input)
    print(f"Checking rules on: {args.input} ({len(df)} rows)")

    all_violations = []

    if args.positive_cols:
        cols = [c.strip() for c in args.positive_cols.split(",")]
        all_violations.extend(check_positive(df, cols))

    if args.date_col:
        all_violations.extend(
            check_date_range(df, args.date_col, args.min_date, args.max_date)
        )

    if args.ref_file and args.ref_col and args.ref_target_col:
        ref_df = pd.read_parquet(args.ref_file)
        all_violations.extend(
            check_referential_integrity(df, args.ref_col, ref_df, args.ref_target_col)
        )

    report = {
        "input": args.input,
        "violations": all_violations,
        "passed": len(all_violations) == 0,
    }
    with open(args.output, "w") as f:
        json.dump(report, f, indent=2)

    status = (
        "PASSED" if report["passed"] else f"FAILED ({len(all_violations)} violation(s))"
    )
    print(f"Business rule check: {status}")
    for v in all_violations:
        print(f"  - [{v['rule']}] {v['column']}: {v['issue']}")
    print(f"Report saved: {args.output}")


if __name__ == "__main__":
    main()
