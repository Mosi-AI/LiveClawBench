"""Data Ingestion Service - Universal loader that detects format by extension."""

import argparse
import os
import pandas as pd


SUPPORTED_FORMATS = {".csv", ".xlsx", ".xls", ".json", ".parquet", ".pq"}


def detect_and_load(input_path):
    """Detect file format by extension and load into a DataFrame."""
    ext = os.path.splitext(input_path)[1].lower()

    if ext == ".csv":
        df = pd.read_csv(input_path)
    elif ext in (".xlsx", ".xls"):
        df = pd.read_excel(input_path)
    elif ext == ".json":
        df = pd.read_json(input_path)
    elif ext in (".parquet", ".pq"):
        df = pd.read_parquet(input_path)
    else:
        raise ValueError(f"Unsupported format: {ext}. Supported: {SUPPORTED_FORMATS}")

    print(f"Detected format: {ext}")
    return df


def save_output(df, output_path):
    """Save DataFrame to the format indicated by output path extension."""
    ext = os.path.splitext(output_path)[1].lower()

    if ext == ".csv":
        df.to_csv(output_path, index=False)
    elif ext in (".xlsx", ".xls"):
        df.to_excel(output_path, index=False)
    elif ext == ".json":
        df.to_json(output_path, orient="records", indent=2)
    elif ext in (".parquet", ".pq"):
        df.to_parquet(output_path, index=False)
    else:
        df.to_parquet(output_path, index=False)

    print(f"Saved as: {ext} -> {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Universal data ingestion service")
    parser.add_argument("-i", "--input", required=True, help="Input file path")
    parser.add_argument("-o", "--output", required=True, help="Output file path")
    args = parser.parse_args()

    df = detect_and_load(args.input)
    save_output(df, args.output)

    print(f"Ingested: {args.input}")
    print(f"  Rows: {len(df)}, Columns: {len(df.columns)}")
    print(f"  Columns: {list(df.columns)}")


if __name__ == "__main__":
    main()
