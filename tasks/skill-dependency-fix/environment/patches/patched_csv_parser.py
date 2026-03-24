#!/usr/bin/env python3
"""CSV Parser — reads CSV files and outputs JSON records.

Supports comma, tab, pipe, and semicolon delimiters with configurable
encoding, quote character, and comment-line skipping.
"""

import argparse
import csv
import json
import os
import sys

SUPPORTED_DELIMITERS = {",", "\t", "|", ";"}


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


def parse_csv(input_path: str, delimiter: str = ",", encoding: str = "utf-8",
              quote_char: str = '"', comment_prefix: str = "#") -> tuple:
    """Parse a CSV file into a list of dicts, skipping comment lines."""
    records = []
    skipped = 0
    with open(input_path, "r", encoding=encoding, newline="") as f:
        # Filter out comment lines before passing to csv reader
        lines = []
        for line in f:
            if line.strip().startswith(comment_prefix):
                skipped += 1
            else:
                lines.append(line)

    # Re-parse from filtered lines
    import io
    reader = csv.DictReader(io.StringIO("".join(lines)), delimiter=delimiter,
                            quotechar=quote_char)
    for row in reader:
        record = {k: try_numeric(v) for k, v in row.items()}
        records.append(record)
    return records, skipped


def main():
    parser = argparse.ArgumentParser(description="Parse CSV files into JSON records")
    parser.add_argument("-i", "--input", required=True, help="Input CSV file path")
    parser.add_argument("-d", "--delimiter", default=",", help="Column delimiter (default: ,)")
    parser.add_argument("-e", "--encoding", default="utf-8", help="File encoding")
    parser.add_argument("-q", "--quote-char", default='"', help="Quote character (default: \")")
    parser.add_argument("--comment-prefix", default="#", help="Comment line prefix (default: #)")
    parser.add_argument("-o", "--output", required=True, help="Output directory")
    args = parser.parse_args()

    if args.delimiter not in SUPPORTED_DELIMITERS:
        print(f"Error: unsupported delimiter '{args.delimiter}'. "
              f"Use one of: {SUPPORTED_DELIMITERS}", file=sys.stderr)
        sys.exit(1)

    records, skipped = parse_csv(args.input, args.delimiter, args.encoding,
                                  args.quote_char, args.comment_prefix)

    os.makedirs(args.output, exist_ok=True)
    out_path = os.path.join(args.output, "parsed_data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)

    columns = list(records[0].keys()) if records else []
    print(f"Parsed {len(records)} rows, {len(columns)} columns: {columns}")
    if skipped:
        print(f"Skipped {skipped} comment lines (prefix: '{args.comment_prefix}')")
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()
