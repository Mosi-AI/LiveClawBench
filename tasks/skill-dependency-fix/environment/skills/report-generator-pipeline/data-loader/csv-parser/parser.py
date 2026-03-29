#!/usr/bin/env python3
"""CSV Parser — reads CSV files and outputs JSON records.

Supports comma and tab delimiters with configurable encoding.
"""

import argparse
import csv
import json
import os
import sys


def try_numeric(value: str):
    """Attempt to convert a string value to int or float."""
    try:
        return int(value)
    except ValueError:
        pass
    try:
        return float(value)
    except ValueError:
        return value


def parse_csv(input_path: str, delimiter: str = ",", encoding: str = "utf-8") -> list:
    """Parse a CSV file into a list of dicts."""
    records = []
    with open(input_path, "r", encoding=encoding, newline="") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        for row in reader:
            record = {k: try_numeric(v) for k, v in row.items()}
            records.append(record)
    return records


def main():
    parser = argparse.ArgumentParser(description="Parse CSV files into JSON records")
    parser.add_argument("-i", "--input", required=True, help="Input CSV file path")
    parser.add_argument(
        "-d", "--delimiter", default=",", help="Column delimiter (default: ,)"
    )
    parser.add_argument("-e", "--encoding", default="utf-8", help="File encoding")
    parser.add_argument("-o", "--output", required=True, help="Output directory")
    args = parser.parse_args()

    if args.delimiter not in (",", "\t"):
        print(
            f"Error: unsupported delimiter '{args.delimiter}'. Use ',' or '\\t'.",
            file=sys.stderr,
        )
        sys.exit(1)

    records = parse_csv(args.input, args.delimiter, args.encoding)

    os.makedirs(args.output, exist_ok=True)
    out_path = os.path.join(args.output, "parsed_data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)

    columns = list(records[0].keys()) if records else []
    print(f"Parsed {len(records)} rows, {len(columns)} columns: {columns}")
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()
