"""Multi-Format Exporter - Export data to CSV, JSON, Parquet, and Excel formats."""

import argparse
import os
import pandas as pd


def export_to_format(df, output_path, fmt=None, **kwargs):
    """Export DataFrame to the specified format."""
    if fmt is None:
        fmt = os.path.splitext(output_path)[1].lstrip(".").lower()

    if fmt == "csv":
        df.to_csv(output_path, index=False, **kwargs)
    elif fmt == "json":
        df.to_json(output_path, orient="records", indent=2, **kwargs)
    elif fmt in ("parquet", "pq"):
        df.to_parquet(output_path, index=False, **kwargs)
    elif fmt in ("xlsx", "excel"):
        df.to_excel(output_path, index=False, **kwargs)
    else:
        raise ValueError(f"Unsupported format: {fmt}. Use: csv, json, parquet, xlsx")

    size_kb = os.path.getsize(output_path) / 1024
    print(f"  [{fmt}] {output_path} ({size_kb:.1f} KB)")


def main():
    parser = argparse.ArgumentParser(description="Export data to multiple formats")
    parser.add_argument("-i", "--input", required=True, help="Input parquet file")
    parser.add_argument(
        "-o",
        "--output",
        required=True,
        help="Output path (base name without extension for multi-format)",
    )
    parser.add_argument(
        "-f",
        "--formats",
        default="csv",
        help="Comma-separated formats: csv,json,parquet,xlsx",
    )
    parser.add_argument(
        "--columns", default=None, help="Comma-separated columns to export"
    )
    args = parser.parse_args()

    df = pd.read_parquet(args.input)
    print(f"Loaded: {args.input} ({len(df)} rows, {len(df.columns)} cols)")

    # Filter columns if specified
    if args.columns:
        col_list = [c.strip() for c in args.columns.split(",")]
        df = df[[c for c in col_list if c in df.columns]]

    formats = [f.strip().lower() for f in args.formats.split(",")]
    base = args.output

    # Map format names to extensions
    ext_map = {
        "csv": ".csv",
        "json": ".json",
        "parquet": ".parquet",
        "pq": ".parquet",
        "xlsx": ".xlsx",
        "excel": ".xlsx",
    }

    print(f"Exporting to {len(formats)} format(s):")
    for fmt in formats:
        ext = ext_map.get(fmt, f".{fmt}")
        # If output already has extension and only one format, use as-is
        if len(formats) == 1 and os.path.splitext(base)[1]:
            out_path = base
        else:
            out_path = base + ext
        export_to_format(df, out_path, fmt)

    print("Export complete.")


if __name__ == "__main__":
    main()
