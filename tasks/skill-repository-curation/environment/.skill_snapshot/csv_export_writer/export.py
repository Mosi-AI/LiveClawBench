"""CSV Export Writer - Export DataFrame to CSV with configurable options."""

import argparse
import pandas as pd


def export_csv(
    df,
    output_path,
    delimiter=",",
    encoding="utf-8",
    include_index=False,
    columns=None,
    float_format=None,
    date_format=None,
    na_rep="",
):
    """Export a DataFrame to CSV with various formatting options."""
    # Select specific columns if requested
    if columns:
        col_list = [c.strip() for c in columns.split(",")]
        missing = [c for c in col_list if c not in df.columns]
        if missing:
            print(f"  Warning: columns not found: {missing}")
        col_list = [c for c in col_list if c in df.columns]
        df = df[col_list]

    df.to_csv(
        output_path,
        sep=delimiter,
        encoding=encoding,
        index=include_index,
        float_format=float_format,
        date_format=date_format,
        na_rep=na_rep,
    )

    print(f"Exported CSV: {output_path}")
    print(f"  Rows: {len(df)}")
    print(f"  Columns: {list(df.columns)}")
    print(f"  Delimiter: '{delimiter}'")
    print(f"  Encoding: {encoding}")
    print(f"  Include index: {include_index}")


def main():
    parser = argparse.ArgumentParser(description="Export data to CSV")
    parser.add_argument("-i", "--input", required=True, help="Input parquet file")
    parser.add_argument("-o", "--output", required=True, help="Output CSV file path")
    parser.add_argument("-d", "--delimiter", default=",", help="Column delimiter")
    parser.add_argument("-e", "--encoding", default="utf-8", help="Output encoding")
    parser.add_argument(
        "--include-index", action="store_true", help="Include row index"
    )
    parser.add_argument(
        "--columns", default=None, help="Comma-separated columns to export"
    )
    parser.add_argument(
        "--float-format", default=None, help="Float format string, e.g. '%.2f'"
    )
    parser.add_argument(
        "--date-format", default=None, help="Date format string, e.g. '%%Y-%%m-%%d'"
    )
    parser.add_argument(
        "--na-rep", default="", help="String representation of NA values"
    )
    args = parser.parse_args()

    df = pd.read_parquet(args.input)
    print(f"Loaded: {args.input} ({len(df)} rows, {len(df.columns)} cols)")

    export_csv(
        df,
        args.output,
        delimiter=args.delimiter,
        encoding=args.encoding,
        include_index=args.include_index,
        columns=args.columns,
        float_format=args.float_format,
        date_format=args.date_format,
        na_rep=args.na_rep,
    )


if __name__ == "__main__":
    main()
