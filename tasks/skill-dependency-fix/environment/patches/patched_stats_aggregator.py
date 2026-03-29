#!/usr/bin/env python3
"""Stats Aggregator — group-by aggregation with configurable metrics.

v1.1.0: Added percentile and mode metrics, plus output metadata section.
"""

import argparse
import json
import os
import statistics
import sys
from datetime import datetime


def percentile(vals, p):
    """Compute the p-th percentile of a sorted list."""
    sorted_vals = sorted(vals)
    n = len(sorted_vals)
    if n == 0:
        return 0
    k = (p / 100) * (n - 1)
    f = int(k)
    c = f + 1
    if c >= n:
        return sorted_vals[f]
    return sorted_vals[f] + (k - f) * (sorted_vals[c] - sorted_vals[f])


METRIC_FUNCS = {
    "mean": lambda vals, **kw: round(statistics.mean(vals), 4),
    "median": lambda vals, **kw: round(statistics.median(vals), 4),
    "sum": lambda vals, **kw: round(sum(vals), 4),
    "count": lambda vals, **kw: len(vals),
    "min": lambda vals, **kw: min(vals),
    "max": lambda vals, **kw: max(vals),
    "mode": lambda vals, **kw: statistics.mode(vals) if vals else 0,
}

ALL_METRICS = list(METRIC_FUNCS.keys()) + ["percentile"]


def aggregate(records, group_col, value_col, metrics, percentiles_list):
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

    result_groups = {}
    for key, vals in sorted(groups.items()):
        group_result = {}
        for m in metrics:
            if m == "percentile":
                for p in percentiles_list:
                    group_result[f"percentile_{p}"] = round(percentile(vals, p), 4)
            elif m in METRIC_FUNCS and vals:
                group_result[m] = METRIC_FUNCS[m](vals)
        result_groups[key] = group_result

    metadata = {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "total_rows": len(records),
        "group_count": len(result_groups),
        "value_column": value_col,
        "metrics_computed": metrics,
    }

    return {
        "group_column": group_col,
        "metadata": metadata,
        "groups": result_groups,
    }


def main():
    parser = argparse.ArgumentParser(description="Compute aggregate statistics")
    parser.add_argument("-i", "--input", required=True, help="Input JSON records file")
    parser.add_argument("-g", "--group-by", required=True, help="Column to group by")
    parser.add_argument(
        "-v", "--value-column", required=True, help="Numeric column to aggregate"
    )
    parser.add_argument(
        "--metrics",
        default="mean,median,sum,count,min,max",
        help="Comma-separated metrics (default: mean,median,sum,count,min,max)",
    )
    parser.add_argument(
        "--percentiles",
        default="25,75",
        help="Comma-separated percentile values (default: 25,75)",
    )
    parser.add_argument("-o", "--output", required=True, help="Output directory")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        records = json.load(f)

    metrics = [m.strip() for m in args.metrics.split(",")]
    invalid = [m for m in metrics if m not in ALL_METRICS]
    if invalid:
        print(
            f"Error: unknown metrics: {invalid}. Available: {ALL_METRICS}",
            file=sys.stderr,
        )
        sys.exit(1)

    percentiles_list = [int(p.strip()) for p in args.percentiles.split(",")]

    result = aggregate(
        records, args.group_by, args.value_column, metrics, percentiles_list
    )

    os.makedirs(args.output, exist_ok=True)
    out_path = os.path.join(args.output, "stats_report.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    n_groups = len(result["groups"])
    print(
        f"Aggregated {len(records)} records into {n_groups} groups by '{args.group_by}'"
    )
    print(f"Metrics: {metrics}")
    if "percentile" in metrics:
        print(f"Percentiles: {percentiles_list}")
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()
