#!/usr/bin/env python3
"""Data Filter — filter rows by comparison expressions."""

import argparse
import json
import os
import re


def parse_expr(expr: str):
    """Parse 'column>=value' into (column, operator, value)."""
    match = re.match(r"^(\w+)\s*(>=|<=|!=|==|>|<)\s*(.+)$", expr)
    if not match:
        raise ValueError(f"Invalid filter expression: {expr}")
    col, op, val = match.groups()
    # Try numeric conversion
    try:
        val = float(val)
    except ValueError:
        pass
    return col, op, val


OPS = {
    ">": lambda a, b: a > b,
    "<": lambda a, b: a < b,
    ">=": lambda a, b: a >= b,
    "<=": lambda a, b: a <= b,
    "==": lambda a, b: a == b,
    "!=": lambda a, b: a != b,
}


def filter_records(records: list, expr: str) -> list:
    """Filter records by expression."""
    col, op, val = parse_expr(expr)
    func = OPS[op]
    result = []
    for rec in records:
        rec_val = rec.get(col)
        if rec_val is None:
            continue
        if isinstance(val, float) and not isinstance(rec_val, (int, float)):
            try:
                rec_val = float(rec_val)
            except (ValueError, TypeError):
                continue
        if func(rec_val, val):
            result.append(rec)
    return result


def main():
    parser = argparse.ArgumentParser(description="Filter rows by expression")
    parser.add_argument("-i", "--input", required=True, help="Input JSON records file")
    parser.add_argument(
        "--expr", required=True, help="Filter expression, e.g. revenue>500"
    )
    parser.add_argument("-o", "--output", required=True, help="Output directory")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        records = json.load(f)

    before = len(records)
    filtered = filter_records(records, args.expr)
    after = len(filtered)

    os.makedirs(args.output, exist_ok=True)
    out_path = os.path.join(args.output, "filtered_data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(filtered, f, indent=2, ensure_ascii=False)

    print(f"Filter '{args.expr}': {before} -> {after} rows ({before - after} removed)")
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()
