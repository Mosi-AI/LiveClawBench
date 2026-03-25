#!/usr/bin/env python3
"""
log-parser skill — Filter JSON-lines log files by time range and severity,
output matching events as CSV.
"""

import argparse
import csv
import json
import sys
from datetime import datetime
from pathlib import Path

CSV_COLUMNS = [
    "timestamp",
    "level",
    "service",
    "endpoint",
    "response_time_ms",
    "status_code",
    "message",
]


def parse_time(t: str) -> datetime:
    """Parse HH:MM or HH:MM:SS into a datetime (date part is ignored)."""
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(t, fmt)
        except ValueError:
            continue
    raise ValueError(f"Cannot parse time: {t}")


def extract_time(ts_str: str) -> datetime:
    """Extract the time component from an ISO-8601 timestamp string."""
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(ts_str, fmt)
        except ValueError:
            continue
    raise ValueError(f"Cannot parse timestamp: {ts_str}")


def main():
    parser = argparse.ArgumentParser(
        description="Parse and filter JSONL log files to CSV"
    )
    parser.add_argument("-i", "--input", required=True, help="Input .jsonl log file")
    parser.add_argument("-o", "--output", required=True, help="Output CSV file")
    parser.add_argument("--start", default=None, help="Start time filter (HH:MM)")
    parser.add_argument("--end", default=None, help="End time filter (HH:MM)")
    parser.add_argument(
        "--levels", default=None, help="Comma-separated severity levels"
    )
    args = parser.parse_args()

    start_t = parse_time(args.start) if args.start else None
    end_t = parse_time(args.end) if args.end else None
    levels = (
        {lv.strip().upper() for lv in args.levels.split(",")} if args.levels else None
    )

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    skipped = 0
    with open(input_path, "r", encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                skipped += 1
                continue

            # Time filter
            if start_t or end_t:
                try:
                    ts = extract_time(entry.get("timestamp", ""))
                    t = ts.replace(year=1900, month=1, day=1)
                    if start_t and t < start_t:
                        continue
                    if end_t and t > end_t:
                        continue
                except ValueError:
                    skipped += 1
                    continue

            # Level filter
            if levels:
                entry_level = entry.get("level", "").upper()
                if entry_level not in levels:
                    continue

            row = {col: entry.get(col, "") for col in CSV_COLUMNS}
            rows.append(row)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(
        f"Wrote {len(rows)} events to {args.output} (skipped {skipped} malformed lines)"
    )


if __name__ == "__main__":
    main()
