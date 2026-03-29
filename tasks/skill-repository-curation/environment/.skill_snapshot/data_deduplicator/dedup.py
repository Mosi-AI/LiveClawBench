"""Data Deduplicator - Remove duplicate rows by key columns or all columns."""

import argparse
import pandas as pd


def deduplicate(df, key_columns=None, keep="first"):
    """Remove duplicate rows, optionally based on specific key columns."""
    rows_before = len(df)

    if key_columns:
        keys = [k.strip() for k in key_columns.split(",")]
        missing = [k for k in keys if k not in df.columns]
        if missing:
            raise ValueError(f"Key columns not found: {missing}")
        df = df.drop_duplicates(subset=keys, keep=keep)
        print(f"  Dedup key columns: {keys}")
    else:
        df = df.drop_duplicates(keep=keep)
        print("  Dedup on all columns")

    rows_after = len(df)
    removed = rows_before - rows_after

    print(f"  Keep strategy: {keep}")
    print(f"  Rows before: {rows_before}")
    print(f"  Rows after:  {rows_after}")
    print(f"  Duplicates removed: {removed}")
    return df


def main():
    parser = argparse.ArgumentParser(description="Remove duplicate rows from data")
    parser.add_argument("-i", "--input", required=True, help="Input parquet file")
    parser.add_argument("-o", "--output", required=True, help="Output parquet file")
    parser.add_argument(
        "-k",
        "--key-columns",
        default=None,
        help="Comma-separated key columns for dedup (default: all)",
    )
    parser.add_argument(
        "--keep",
        default="first",
        choices=["first", "last", "false"],
        help="Which duplicate to keep",
    )
    args = parser.parse_args()

    keep = False if args.keep == "false" else args.keep

    df = pd.read_parquet(args.input)
    print(f"Loaded: {args.input}")
    df = deduplicate(df, args.key_columns, keep)
    df.to_parquet(args.output, index=False)
    print(f"Saved: {args.output}")


if __name__ == "__main__":
    main()
