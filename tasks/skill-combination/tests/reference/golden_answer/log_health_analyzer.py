#!/usr/bin/env python3
"""
log-health-analyzer — Composite pipeline skill.
Chains log-parser (JSONL → CSV) and csv-stats-reporter (CSV → JSON stats)
into a single unified workflow.
"""

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent / "skills"
LOG_PARSER = SKILL_DIR / "log-parser" / "log_parser.py"
STATS_REPORTER = SKILL_DIR / "csv-stats-reporter" / "stats_reporter.py"


def main():
    parser = argparse.ArgumentParser(
        description="Composite pipeline: filter JSONL logs then compute stats"
    )
    # Parameters from log-parser
    parser.add_argument("-i", "--input", required=True, help="Input JSONL log file")
    parser.add_argument(
        "-o", "--output", required=True, help="Output JSON stats report"
    )
    parser.add_argument("--start", default=None, help="Start time filter (HH:MM)")
    parser.add_argument("--end", default=None, help="End time filter (HH:MM)")
    parser.add_argument(
        "--levels",
        default=None,
        help="Comma-separated severity levels (e.g. ERROR,WARN)",
    )

    # Parameters from csv-stats-reporter
    parser.add_argument(
        "--columns", default=None, help="Numeric columns to analyse (comma-separated)"
    )
    parser.add_argument(
        "--group-by", default=None, help="Column to group statistics by"
    )

    # Pipeline parameters
    parser.add_argument(
        "--keep-csv", action="store_true", help="Keep the intermediate filtered CSV"
    )

    args = parser.parse_args()

    # Validate input
    if not Path(args.input).exists():
        print(f"Error: input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    # Create intermediate CSV path
    if args.keep_csv:
        csv_path = Path(args.output).with_suffix(".filtered.csv")
    else:
        tmp = tempfile.NamedTemporaryFile(suffix=".csv", delete=False)
        csv_path = Path(tmp.name)
        tmp.close()

    try:
        # ── Stage 1: Log Parsing (JSONL → filtered CSV) ──
        print("Stage 1: Filtering log events...")
        cmd1 = [
            sys.executable,
            str(LOG_PARSER),
            "-i",
            args.input,
            "-o",
            str(csv_path),
        ]
        if args.start:
            cmd1.extend(["--start", args.start])
        if args.end:
            cmd1.extend(["--end", args.end])
        if args.levels:
            cmd1.extend(["--levels", args.levels])

        result1 = subprocess.run(cmd1, capture_output=True, text=True)
        if result1.returncode != 0:
            print(f"Error in log-parser: {result1.stderr}", file=sys.stderr)
            sys.exit(1)
        print(f"  {result1.stdout.strip()}")

        # ── Stage 2: Stats Computation (filtered CSV → JSON report) ──
        print("Stage 2: Computing statistics...")
        cmd2 = [
            sys.executable,
            str(STATS_REPORTER),
            "-i",
            str(csv_path),
            "-o",
            args.output,
        ]
        if args.columns:
            cmd2.extend(["--columns", args.columns])
        if args.group_by:
            cmd2.extend(["--group-by", args.group_by])

        result2 = subprocess.run(cmd2, capture_output=True, text=True)
        if result2.returncode != 0:
            print(f"Error in csv-stats-reporter: {result2.stderr}", file=sys.stderr)
            sys.exit(1)
        print(f"  {result2.stdout.strip()}")

        print(f"\nPipeline complete: {args.output}")

    finally:
        # Cleanup intermediate CSV if not keeping
        if not args.keep_csv and csv_path.exists():
            os.unlink(csv_path)
            print("  (intermediate CSV cleaned up)")


if __name__ == "__main__":
    main()
