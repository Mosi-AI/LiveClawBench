"""CSV Data Loader - Load CSV files with configurable options and save as parquet."""

import argparse
import pandas as pd


def load_csv(
    input_path, output_path, delimiter=",", encoding="utf-8", date_columns=None
):
    """Load a CSV file, strip whitespace, parse dates, and save as parquet."""
    parse_dates = date_columns.split(",") if date_columns else False

    df = pd.read_csv(
        input_path,
        delimiter=delimiter,
        encoding=encoding,
        parse_dates=parse_dates,
    )

    # Strip whitespace from string columns
    str_cols = df.select_dtypes(include=["object"]).columns
    for col in str_cols:
        df[col] = df[col].str.strip()

    df.to_parquet(output_path, index=False)

    print(f"Loaded CSV: {input_path}")
    print(f"  Rows: {len(df)}, Columns: {len(df.columns)}")
    print(f"  Columns: {list(df.columns)}")
    print(f"  Dtypes: {dict(df.dtypes)}")
    print(f"  Saved to: {output_path}")
    return df


def main():
    parser = argparse.ArgumentParser(description="Load CSV and save as parquet")
    parser.add_argument("-i", "--input", required=True, help="Input CSV file path")
    parser.add_argument(
        "-o", "--output", required=True, help="Output parquet file path"
    )
    parser.add_argument("-d", "--delimiter", default=",", help="Column delimiter")
    parser.add_argument("-e", "--encoding", default="utf-8", help="File encoding")
    parser.add_argument(
        "--date-columns", default=None, help="Comma-separated date columns to parse"
    )
    args = parser.parse_args()

    load_csv(args.input, args.output, args.delimiter, args.encoding, args.date_columns)


if __name__ == "__main__":
    main()
