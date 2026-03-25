#!/usr/bin/env python3
import csv
import re
from collections import OrderedDict


def parse_date(date_str):
    """Parse various date formats and return YYYY-MM-DD string."""
    date_str = date_str.strip()

    formats = [
        # MM/DD/YYYY
        (
            r"(\d{1,2})/(\d{1,2})/(\d{4})",
            lambda m: f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}",
        ),
        # YYYY-MM-DD
        (
            r"(\d{4})-(\d{1,2})-(\d{1,2})",
            lambda m: f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}",
        ),
        # Mon DD YYYY
        (
            r"([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})",
            lambda m: f"{m.group(3)}-{parse_month(m.group(1))}-{int(m.group(2)):02d}",
        ),
        # MM-DD-YYYY
        (
            r"(\d{1,2})-(\d{1,2})-(\d{4})",
            lambda m: f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}",
        ),
        # YYYY/MM/DD
        (
            r"(\d{4})/(\d{1,2})/(\d{1,2})",
            lambda m: f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}",
        ),
    ]

    for pattern, converter in formats:
        match = re.match(pattern, date_str)
        if match:
            return converter(match)

    return date_str


def parse_month(month_str):
    """Convert month abbreviation to number."""
    months = {
        "jan": "01",
        "feb": "02",
        "mar": "03",
        "apr": "04",
        "may": "05",
        "jun": "06",
        "jul": "07",
        "aug": "08",
        "sep": "09",
        "oct": "10",
        "nov": "11",
        "dec": "12",
    }
    return months.get(month_str.lower(), "01")


def clean_csv(input_file, output_file):
    """Clean a CSV file."""
    rows_by_order_id = OrderedDict()

    with open(input_file, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for row in reader:
            # Skip empty rows
            if all(not str(v).strip() for v in row.values()):
                continue

            order_id = row.get("order_id", "").strip()

            # Skip if we've seen this order_id before
            if order_id in rows_by_order_id:
                continue

            # Standardize the date
            if "date" in row:
                row["date"] = parse_date(row["date"])

            # Convert amount to float for sorting
            try:
                row["_amount_float"] = float(row.get("amount", 0))
            except ValueError:
                row["_amount_float"] = 0.0

            rows_by_order_id[order_id] = row

    # Convert to list and sort by amount in descending order
    rows = list(rows_by_order_id.values())
    rows.sort(key=lambda x: x["_amount_float"], reverse=True)

    # Remove the temporary sorting column
    for row in rows:
        del row["_amount_float"]

    # Write output
    with open(output_file, "w", newline="", encoding="utf-8") as f:
        if rows:
            fieldnames = list(rows[0].keys())
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    return len(rows)


def main():
    files_to_clean = [
        (
            "/home/dulif/.openclaw/benchmark/sh/sh_case1/environment/data/sales_may.csv",
            "/home/dulif/.openclaw/benchmark/sh/sh_case1/environment/cleaned/sales_may_cleaned.csv",
        ),
        (
            "/home/dulif/.openclaw/benchmark/sh/sh_case1/environment/data/sales_jul.csv",
            "/home/dulif/.openclaw/benchmark/sh/sh_case1/environment/cleaned/sales_jul_cleaned.csv",
        ),
        (
            "/home/dulif/.openclaw/benchmark/sh/sh_case1/environment/data/sales_aug.csv",
            "/home/dulif/.openclaw/benchmark/sh/sh_case1/environment/cleaned/sales_aug_cleaned.csv",
        ),
    ]

    for input_file, output_file in files_to_clean:
        row_count = clean_csv(input_file, output_file)
        print(f"Cleaned: {output_file} ({row_count} rows)")


if __name__ == "__main__":
    main()
