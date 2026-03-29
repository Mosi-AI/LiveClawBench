"""Data Aggregator - Group-by aggregation with configurable metrics."""

import argparse
import pandas as pd


SUPPORTED_AGGS = {
    "sum",
    "mean",
    "median",
    "min",
    "max",
    "count",
    "std",
    "first",
    "last",
}


def parse_metrics(metrics_str):
    """Parse metrics string like 'revenue:sum,cost:mean,quantity:sum'."""
    metrics = {}
    for spec in metrics_str.split(","):
        parts = spec.strip().split(":")
        if len(parts) != 2:
            raise ValueError(
                f"Invalid metric spec: {spec}. Use format 'column:aggregation'"
            )
        col, agg = parts[0].strip(), parts[1].strip()
        if agg not in SUPPORTED_AGGS:
            raise ValueError(
                f"Unsupported aggregation '{agg}'. Supported: {SUPPORTED_AGGS}"
            )
        if col not in metrics:
            metrics[col] = []
        metrics[col].append(agg)
    return metrics


def aggregate(df, group_by, metrics):
    """Perform group-by aggregation."""
    group_cols = [g.strip() for g in group_by.split(",")]

    missing = [c for c in group_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Group-by columns not found: {missing}")

    agg_dict = parse_metrics(metrics)

    result = df.groupby(group_cols).agg(agg_dict)

    # Flatten multi-level column names
    result.columns = [
        "_".join(col).strip() if isinstance(col, tuple) else col
        for col in result.columns
    ]
    result = result.reset_index()

    print(f"  Group by: {group_cols}")
    print(f"  Metrics: {agg_dict}")
    print(f"  Result groups: {len(result)}")
    print(f"  Result columns: {list(result.columns)}")
    return result


def main():
    parser = argparse.ArgumentParser(description="Aggregate data with group-by")
    parser.add_argument("-i", "--input", required=True, help="Input parquet file")
    parser.add_argument("-o", "--output", required=True, help="Output parquet file")
    parser.add_argument(
        "-g", "--group-by", required=True, help="Comma-separated group-by columns"
    )
    parser.add_argument(
        "-m",
        "--metrics",
        required=True,
        help="Metrics as 'col:agg,...' e.g. 'revenue:sum,cost:mean'",
    )
    args = parser.parse_args()

    df = pd.read_parquet(args.input)
    print(f"Loaded: {args.input} ({len(df)} rows)")

    result = aggregate(df, args.group_by, args.metrics)

    result.to_parquet(args.output, index=False)
    print(f"Saved: {args.output} ({len(result)} rows)")


if __name__ == "__main__":
    main()
