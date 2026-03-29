"""Null Value Processor - Handle missing values with configurable strategies."""

import argparse
import pandas as pd


def process_nulls(df, strategy="drop", columns=None, fill_value=None):
    """Handle null values using the specified strategy."""
    target_cols = columns.split(",") if columns else df.columns.tolist()
    null_before = df[target_cols].isnull().sum().sum()

    if strategy == "drop":
        df = df.dropna(subset=target_cols)
    elif strategy == "fill-mean":
        for col in target_cols:
            if pd.api.types.is_numeric_dtype(df[col]):
                df[col] = df[col].fillna(df[col].mean())
    elif strategy == "fill-median":
        for col in target_cols:
            if pd.api.types.is_numeric_dtype(df[col]):
                df[col] = df[col].fillna(df[col].median())
    elif strategy == "fill-constant":
        value = fill_value if fill_value is not None else "MISSING"
        for col in target_cols:
            df[col] = df[col].fillna(value)
    elif strategy == "fill-ffill":
        df[target_cols] = df[target_cols].ffill()
    else:
        raise ValueError(f"Unknown strategy: {strategy}")

    null_after = df[target_cols].isnull().sum().sum()
    print(f"Strategy: {strategy}")
    print(f"  Nulls before: {null_before}, after: {null_after}")
    print(f"  Resolved: {null_before - null_after}")
    return df


def main():
    parser = argparse.ArgumentParser(description="Process null values in data")
    parser.add_argument("-i", "--input", required=True, help="Input parquet file")
    parser.add_argument("-o", "--output", required=True, help="Output parquet file")
    parser.add_argument(
        "-s",
        "--strategy",
        default="drop",
        choices=["drop", "fill-mean", "fill-median", "fill-constant", "fill-ffill"],
        help="Null handling strategy",
    )
    parser.add_argument(
        "-c", "--columns", default=None, help="Comma-separated target columns"
    )
    parser.add_argument(
        "--fill-value", default=None, help="Fill value for fill-constant strategy"
    )
    args = parser.parse_args()

    df = pd.read_parquet(args.input)
    print(f"Loaded: {args.input} ({len(df)} rows)")
    df = process_nulls(df, args.strategy, args.columns, args.fill_value)
    df.to_parquet(args.output, index=False)
    print(f"Saved: {args.output} ({len(df)} rows)")


if __name__ == "__main__":
    main()
