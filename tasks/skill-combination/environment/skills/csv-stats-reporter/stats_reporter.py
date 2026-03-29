#!/usr/bin/env python3
"""
csv-stats-reporter skill — Compute descriptive statistics for numeric columns
in a CSV file and output a JSON report.
"""

import argparse
import csv
import json
import math
import sys
from collections import defaultdict
from pathlib import Path


def percentile(sorted_data: list, p: float) -> float:
    """Compute the p-th percentile of a sorted list."""
    if not sorted_data:
        return 0.0
    k = (len(sorted_data) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_data[int(k)]
    return sorted_data[f] * (c - k) + sorted_data[c] * (k - f)


def compute_stats(values: list) -> dict:
    """Compute descriptive statistics for a list of numeric values."""
    if not values:
        return {
            "count": 0,
            "mean": None,
            "median": None,
            "std": None,
            "min": None,
            "max": None,
            "p95": None,
            "p99": None,
        }

    n = len(values)
    s = sorted(values)
    mean_val = sum(s) / n
    # Population variance (divide by n, not n-1) — intentional for this
    # benchmark fixture; the full dataset per group is available, not a sample.
    variance = sum((x - mean_val) ** 2 for x in s) / n if n > 1 else 0
    std_val = math.sqrt(variance)

    return {
        "count": n,
        "mean": round(mean_val, 2),
        "median": round(percentile(s, 50), 2),
        "std": round(std_val, 2),
        "min": round(s[0], 2),
        "max": round(s[-1], 2),
        "p95": round(percentile(s, 95), 2),
        "p99": round(percentile(s, 99), 2),
    }


def is_numeric(value: str) -> bool:
    try:
        float(value)
        return True
    except (ValueError, TypeError):
        return False


def main():
    parser = argparse.ArgumentParser(description="Compute CSV column statistics")
    parser.add_argument("-i", "--input", required=True, help="Input CSV file")
    parser.add_argument("-o", "--output", required=True, help="Output JSON report")
    parser.add_argument(
        "--columns", default=None, help="Columns to analyse (comma-separated)"
    )
    parser.add_argument("--group-by", default=None, help="Column to group by")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    with open(input_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        rows = list(reader)

    # Determine which columns to analyse
    if args.columns:
        target_cols = [c.strip() for c in args.columns.split(",")]
    else:
        # Auto-detect numeric columns from first 20 rows
        target_cols = []
        sample = rows[:20]
        for col in headers:
            numeric_count = sum(1 for r in sample if is_numeric(r.get(col, "")))
            if numeric_count > len(sample) * 0.5:
                target_cols.append(col)

    group_col = args.group_by

    if group_col and group_col not in headers:
        print(f"Warning: group-by column '{group_col}' not found", file=sys.stderr)
        group_col = None

    # Collect values
    if group_col:
        grouped = defaultdict(lambda: defaultdict(list))
        for row in rows:
            g = row.get(group_col, "UNKNOWN")
            for col in target_cols:
                val = row.get(col, "")
                if is_numeric(val):
                    grouped[g][col].append(float(val))
        stats = {}
        for g, cols_data in grouped.items():
            stats[g] = {col: compute_stats(vals) for col, vals in cols_data.items()}
    else:
        col_values = defaultdict(list)
        for row in rows:
            for col in target_cols:
                val = row.get(col, "")
                if is_numeric(val):
                    col_values[col].append(float(val))
        stats = {col: compute_stats(vals) for col, vals in col_values.items()}

    report = {
        "source": str(input_path),
        "total_rows": len(rows),
        "columns_analysed": target_cols,
        "stats": stats,
    }

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(
        f"Stats report written to {args.output} ({len(rows)} rows, {len(target_cols)} columns)"
    )


if __name__ == "__main__":
    main()
