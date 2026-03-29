"""Data Cleaning Toolkit - Combined cleaning: trim, coerce types, nulls, dedup, outliers."""

import argparse
import pandas as pd
import numpy as np


def trim_whitespace(df):
    """Strip whitespace from all string columns."""
    str_cols = df.select_dtypes(include=["object"]).columns
    for col in str_cols:
        df[col] = df[col].str.strip()
    print(f"  Trimmed whitespace in {len(str_cols)} string columns")
    return df


def coerce_types(df, type_map=None):
    """Coerce column types based on a mapping like 'col1:int,col2:float'."""
    if not type_map:
        return df
    for spec in type_map.split(","):
        col, dtype = spec.split(":")
        df[col] = (
            pd.to_numeric(df[col], errors="coerce")
            if dtype in ("int", "float")
            else df[col].astype(dtype)
        )
    print(f"  Coerced types: {type_map}")
    return df


def handle_nulls(df, strategy="drop"):
    """Simple null handling."""
    nulls = df.isnull().sum().sum()
    if strategy == "drop":
        df = df.dropna()
    elif strategy == "fill-mean":
        num_cols = df.select_dtypes(include=[np.number]).columns
        df[num_cols] = df[num_cols].fillna(df[num_cols].mean())
    print(f"  Nulls found: {nulls}, strategy: {strategy}")
    return df


def remove_duplicates(df):
    """Remove exact duplicate rows."""
    before = len(df)
    df = df.drop_duplicates()
    print(f"  Duplicates removed: {before - len(df)}")
    return df


def flag_outliers(df, z_threshold=3.0):
    """Flag rows with outliers using z-score method."""
    num_cols = df.select_dtypes(include=[np.number]).columns
    z_scores = ((df[num_cols] - df[num_cols].mean()) / df[num_cols].std()).abs()
    outlier_mask = (z_scores > z_threshold).any(axis=1)
    df["_is_outlier"] = outlier_mask
    print(f"  Outliers flagged (z>{z_threshold}): {outlier_mask.sum()}")
    return df


def main():
    parser = argparse.ArgumentParser(description="Combined data cleaning toolkit")
    parser.add_argument("-i", "--input", required=True, help="Input parquet file")
    parser.add_argument("-o", "--output", required=True, help="Output parquet file")
    parser.add_argument(
        "--null-strategy", default="drop", help="Null handling strategy"
    )
    parser.add_argument(
        "--type-map", default=None, help="Type coercion map, e.g. col1:int,col2:float"
    )
    parser.add_argument(
        "--z-threshold", type=float, default=3.0, help="Outlier z-score threshold"
    )
    parser.add_argument(
        "--skip-outliers", action="store_true", help="Skip outlier detection"
    )
    args = parser.parse_args()

    df = pd.read_parquet(args.input)
    print(f"Loaded: {args.input} ({len(df)} rows, {len(df.columns)} cols)")

    df = trim_whitespace(df)
    df = coerce_types(df, args.type_map)
    df = handle_nulls(df, args.null_strategy)
    df = remove_duplicates(df)
    if not args.skip_outliers:
        df = flag_outliers(df, args.z_threshold)

    df.to_parquet(args.output, index=False)
    print(f"Saved: {args.output} ({len(df)} rows)")


if __name__ == "__main__":
    main()
