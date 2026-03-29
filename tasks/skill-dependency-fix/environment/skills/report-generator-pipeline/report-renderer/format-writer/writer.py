#!/usr/bin/env python3
"""Format Writer — convert stats report to final CSV or JSON output."""

import argparse
import csv
import json
import os


def write_json(stats: dict, output_dir: str):
    """Write stats as a flat JSON report."""
    group_col = stats["group_column"]
    rows = []
    for group_name, metrics in stats["groups"].items():
        row = {group_col: group_name}
        row.update(metrics)
        rows.append(row)

    out_path = os.path.join(output_dir, "final_report.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2, ensure_ascii=False)
    return out_path


def write_csv(stats: dict, output_dir: str):
    """Write stats as a CSV report."""
    group_col = stats["group_column"]
    groups = stats["groups"]
    if not groups:
        return None

    first_group = next(iter(groups.values()))
    metric_names = list(first_group.keys())
    fieldnames = [group_col] + metric_names

    out_path = os.path.join(output_dir, "final_report.csv")
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for group_name, metrics in groups.items():
            row = {group_col: group_name}
            row.update(metrics)
            writer.writerow(row)
    return out_path


def main():
    parser = argparse.ArgumentParser(description="Write final formatted report")
    parser.add_argument("-i", "--input", required=True, help="Input stats_report.json")
    parser.add_argument(
        "-f", "--format", default="json", choices=["csv", "json"], help="Output format"
    )
    parser.add_argument("-o", "--output", required=True, help="Output directory")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        stats = json.load(f)

    os.makedirs(args.output, exist_ok=True)

    if args.format == "csv":
        out_path = write_csv(stats, args.output)
    else:
        out_path = write_json(stats, args.output)

    n_groups = len(stats.get("groups", {}))
    print(f"Wrote {n_groups} groups to {out_path} ({args.format} format)")


if __name__ == "__main__":
    main()
