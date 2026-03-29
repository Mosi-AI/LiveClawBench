"""Numeric Normalizer - Min-max, z-score, and robust scaling of numeric columns."""

import argparse
import pandas as pd
import numpy as np


def min_max_scale(series):
    """Scale values to [0, 1] range."""
    smin, smax = series.min(), series.max()
    if smax == smin:
        return pd.Series(0.0, index=series.index)
    return (series - smin) / (smax - smin)


def z_score_scale(series):
    """Scale values to zero mean and unit variance."""
    std = series.std()
    if std == 0:
        return pd.Series(0.0, index=series.index)
    return (series - series.mean()) / std


def robust_scale(series):
    """Scale using median and IQR (robust to outliers)."""
    median = series.median()
    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    iqr = q3 - q1
    if iqr == 0:
        return pd.Series(0.0, index=series.index)
    return (series - median) / iqr


SCALERS = {
    "min-max": min_max_scale,
    "z-score": z_score_scale,
    "robust": robust_scale,
}


def normalize(df, method="min-max", columns=None):
    """Normalize numeric columns using the specified method."""
    scaler = SCALERS.get(method)
    if scaler is None:
        raise ValueError(
            f"Unknown method: {method}. Choose from: {list(SCALERS.keys())}"
        )

    if columns:
        target_cols = [c.strip() for c in columns.split(",")]
    else:
        target_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    for col in target_cols:
        if col not in df.columns:
            print(f"  Warning: column '{col}' not found, skipping")
            continue
        original_stats = f"[{df[col].min():.2f}, {df[col].max():.2f}]"
        df[col] = scaler(df[col])
        new_stats = f"[{df[col].min():.2f}, {df[col].max():.2f}]"
        print(f"  {col}: {original_stats} -> {new_stats}")

    print(f"Normalized {len(target_cols)} columns using {method}")
    return df


def main():
    parser = argparse.ArgumentParser(description="Normalize numeric columns")
    parser.add_argument("-i", "--input", required=True, help="Input parquet file")
    parser.add_argument("-o", "--output", required=True, help="Output parquet file")
    parser.add_argument(
        "-m",
        "--method",
        default="min-max",
        choices=list(SCALERS.keys()),
        help="Normalization method",
    )
    parser.add_argument(
        "-c", "--columns", default=None, help="Comma-separated columns to normalize"
    )
    args = parser.parse_args()

    df = pd.read_parquet(args.input)
    print(f"Loaded: {args.input} ({len(df)} rows)")
    df = normalize(df, args.method, args.columns)
    df.to_parquet(args.output, index=False)
    print(f"Saved: {args.output}")


if __name__ == "__main__":
    main()
