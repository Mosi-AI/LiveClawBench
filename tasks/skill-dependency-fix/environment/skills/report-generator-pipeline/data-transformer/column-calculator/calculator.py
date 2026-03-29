#!/usr/bin/env python3
"""Column Calculator — compute derived columns using arithmetic operations."""

import argparse
import json
import os
import sys

CALC_TYPES = {
    "sum": lambda a, b: a + b,
    "diff": lambda a, b: a - b,
    "ratio": lambda a, b: a / b if b != 0 else 0,
    "multiply": lambda a, b: a * b,
}


def calculate(
    records: list, calc_type: str, col_a: str, col_b: str, result_name: str
) -> list:
    """Add a derived column to each record."""
    func = CALC_TYPES[calc_type]
    for rec in records:
        a = float(rec.get(col_a, 0))
        b = float(rec.get(col_b, 0))
        rec[result_name] = round(func(a, b), 4)
    return records


def main():
    parser = argparse.ArgumentParser(description="Compute derived columns")
    parser.add_argument("-i", "--input", required=True, help="Input JSON records file")
    parser.add_argument(
        "--calc",
        required=True,
        choices=list(CALC_TYPES.keys()),
        help="Calculation type",
    )
    parser.add_argument(
        "--columns", required=True, help="Two column names, comma-separated"
    )
    parser.add_argument(
        "--result-name", default="calculated", help="Name for new column"
    )
    parser.add_argument("-o", "--output", required=True, help="Output directory")
    args = parser.parse_args()

    cols = args.columns.split(",")
    if len(cols) != 2:
        print(
            "Error: --columns must specify exactly two column names.", file=sys.stderr
        )
        sys.exit(1)

    with open(args.input, "r", encoding="utf-8") as f:
        records = json.load(f)

    records = calculate(
        records, args.calc, cols[0].strip(), cols[1].strip(), args.result_name
    )

    os.makedirs(args.output, exist_ok=True)
    out_path = os.path.join(args.output, "transformed_data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)

    print(
        f"Computed '{args.calc}' on ({cols[0]}, {cols[1]}) -> '{args.result_name}' for {len(records)} rows"
    )
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()
