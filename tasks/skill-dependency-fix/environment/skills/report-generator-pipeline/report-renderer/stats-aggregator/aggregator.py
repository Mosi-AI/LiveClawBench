#!/usr/bin/env python3
"""Stats Aggregator — group-by aggregation with configurable metrics."""

import argparse
import json
import os
import statistics
import sys

METRIC_FUNCS = {
    "mean": lambda vals: round(statistics.mean(vals), 4),
    "median": lambda vals: round(statistics.median(vals), 4),
    "sum": lambda vals: round(sum(vals), 4),
    "count": lambda vals: len(vals),
    "min": lambda vals: min(vals),
    "max": lambda vals: max(vals),
}

ALL_METRICS = list(METRIC_FUNCS.keys())


def aggregate(records: list, group_col: str, value_col: str, metrics: list) -> dict:
    """Group records and compute metrics."""
    groups = {}
    for rec in records:
        key = str(rec.get(group_col, "unknown"))
        val = rec.get(value_col)
        if val is None:
            continue
        try:
            val = float(val)
        except (ValueError, TypeError):
            continue
        groups.setdefault(key, []).append(val)

    result = {"group_column": group_col, "groups": {}}
    for key, vals in sorted(groups.items()):
        result["groups"][key] = {}
        for m in metrics:
            if m in METRIC_FUNCS and vals:
                result["groups"][key][m] = METRIC_FUNCS[m](vals)

    return result


def main():
    parser = argparse.ArgumentParser(description="Compute aggregate statistics")
    parser.add_argument("-i", "--input", required=True, help="Input JSON records file")
    parser.add_argument("-g", "--group-by", required=True, help="Column to group by")
    parser.add_argument(
        "-v", "--value-column", required=True, help="Numeric column to aggregate"
    )
    parser.add_argument(
        "--metrics",
        default=",".join(ALL_METRICS),
        help="Comma-separated metrics (default: all)",
    )
    parser.add_argument("-o", "--output", required=True, help="Output directory")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        records = json.load(f)

    metrics = [m.strip() for m in args.metrics.split(",")]
    invalid = [m for m in metrics if m not in METRIC_FUNCS]
    if invalid:
        print(
            f"Error: unknown metrics: {invalid}. Available: {ALL_METRICS}",
            file=sys.stderr,
        )
        sys.exit(1)

    result = aggregate(records, args.group_by, args.value_column, metrics)

    os.makedirs(args.output, exist_ok=True)
    out_path = os.path.join(args.output, "stats_report.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    n_groups = len(result["groups"])
    print(
        f"Aggregated {len(records)} records into {n_groups} groups by '{args.group_by}'"
    )
    print(f"Metrics: {metrics}")
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()
