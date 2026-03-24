#!/usr/bin/env python3
"""Column Calculator — compute derived columns using arithmetic and analytical operations.

Supported: sum, diff, multiply, percentage, cumulative_sum, rank.
Note: 'ratio' has been removed in v1.1.0.
"""

import argparse
import json
import os
import sys

# --- Arithmetic operations (two columns) ---

def calc_sum(a, b):
    return a + b

def calc_diff(a, b):
    return a - b

def calc_multiply(a, b):
    return a * b

def calc_percentage(a, b):
    total = a + b
    return round(a / total * 100, 4) if total != 0 else 0

BINARY_CALCS = {
    "sum": calc_sum,
    "diff": calc_diff,
    "multiply": calc_multiply,
    "percentage": calc_percentage,
}

# --- Analytical operations (one column) ---

def calc_cumulative_sum(records, col, result_name):
    running = 0
    for rec in records:
        running += float(rec.get(col, 0))
        rec[result_name] = round(running, 4)
    return records


def calc_rank(records, col, result_name, method="dense"):
    indexed = [(i, float(rec.get(col, 0))) for i, rec in enumerate(records)]
    sorted_vals = sorted(set(v for _, v in indexed), reverse=True)

    if method == "dense":
        rank_map = {v: r + 1 for r, v in enumerate(sorted_vals)}
    elif method == "min":
        rank_map = {}
        rank = 1
        grouped = sorted(indexed, key=lambda x: -x[1])
        i = 0
        while i < len(grouped):
            val = grouped[i][1]
            count = sum(1 for _, v in grouped[i:] if v == val)
            rank_map[val] = rank
            rank += count
            i += count
    elif method == "max":
        rank_map = {}
        rank = 1
        grouped = sorted(indexed, key=lambda x: -x[1])
        i = 0
        while i < len(grouped):
            val = grouped[i][1]
            count = sum(1 for _, v in grouped[i:] if v == val)
            rank_map[val] = rank + count - 1
            rank += count
            i += count
    else:
        rank_map = {v: r + 1 for r, v in enumerate(sorted_vals)}

    for rec in records:
        rec[result_name] = rank_map.get(float(rec.get(col, 0)), 0)
    return records


UNARY_CALCS = {"cumulative_sum", "rank"}
ALL_CALCS = set(BINARY_CALCS.keys()) | UNARY_CALCS


def main():
    parser = argparse.ArgumentParser(description="Compute derived columns")
    parser.add_argument("-i", "--input", required=True, help="Input JSON records file")
    parser.add_argument("--calc", required=True, choices=sorted(ALL_CALCS),
                        help="Calculation type")
    parser.add_argument("--columns", required=True, help="Column name(s), comma-separated")
    parser.add_argument("--result-name", default="calculated", help="Name for new column")
    parser.add_argument("--rank-method", default="dense", choices=["dense", "min", "max"],
                        help="Ranking method (only for rank calc)")
    parser.add_argument("-o", "--output", required=True, help="Output directory")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        records = json.load(f)

    cols = [c.strip() for c in args.columns.split(",")]

    if args.calc in BINARY_CALCS:
        if len(cols) != 2:
            print(f"Error: '{args.calc}' requires exactly 2 columns.", file=sys.stderr)
            sys.exit(1)
        func = BINARY_CALCS[args.calc]
        for rec in records:
            a = float(rec.get(cols[0], 0))
            b = float(rec.get(cols[1], 0))
            rec[args.result_name] = round(func(a, b), 4)
    elif args.calc == "cumulative_sum":
        if len(cols) != 1:
            print("Error: 'cumulative_sum' requires exactly 1 column.", file=sys.stderr)
            sys.exit(1)
        records = calc_cumulative_sum(records, cols[0], args.result_name)
    elif args.calc == "rank":
        if len(cols) != 1:
            print("Error: 'rank' requires exactly 1 column.", file=sys.stderr)
            sys.exit(1)
        records = calc_rank(records, cols[0], args.result_name, args.rank_method)

    os.makedirs(args.output, exist_ok=True)
    out_path = os.path.join(args.output, "transformed_data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)

    print(f"Computed '{args.calc}' on ({', '.join(cols)}) -> '{args.result_name}' for {len(records)} rows")
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()
