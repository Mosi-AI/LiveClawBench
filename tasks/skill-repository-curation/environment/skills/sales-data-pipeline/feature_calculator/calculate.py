"""Feature Calculator - Calculate revenue, margin, time features, moving averages."""
import argparse
import pandas as pd


def add_revenue_features(df, price_col="price", qty_col="quantity"):
    """Calculate revenue and related features."""
    if price_col in df.columns and qty_col in df.columns:
        df["revenue"] = df[price_col] * df[qty_col]
        print(f"  Added 'revenue' = {price_col} * {qty_col}")
    return df


def add_margin_features(df, revenue_col="revenue", cost_col="cost"):
    """Calculate profit margin features."""
    if revenue_col in df.columns and cost_col in df.columns:
        df["profit"] = df[revenue_col] - df[cost_col]
        df["margin_pct"] = (df["profit"] / df[revenue_col]).replace([float("inf"), -float("inf")], 0).fillna(0)
        print("  Added 'profit' and 'margin_pct'")
    return df


def add_time_features(df, date_col="date"):
    """Extract time-based features from a date column."""
    if date_col not in df.columns:
        return df
    dt = pd.to_datetime(df[date_col], errors="coerce")
    df["year"] = dt.dt.year
    df["month"] = dt.dt.month
    df["day_of_week"] = dt.dt.dayofweek
    df["quarter"] = dt.dt.quarter
    df["is_weekend"] = dt.dt.dayofweek.isin([5, 6]).astype(int)
    print(f"  Added time features from '{date_col}': year, month, day_of_week, quarter, is_weekend")
    return df


def add_moving_averages(df, value_col, windows=None, sort_col=None):
    """Calculate moving averages over specified windows."""
    if value_col not in df.columns:
        return df
    if sort_col and sort_col in df.columns:
        df = df.sort_values(sort_col)
    windows = windows or [7, 30]
    for w in windows:
        col_name = f"{value_col}_ma{w}"
        df[col_name] = df[value_col].rolling(window=w, min_periods=1).mean()
        print(f"  Added '{col_name}' (window={w})")
    return df


def main():
    parser = argparse.ArgumentParser(description="Calculate derived features")
    parser.add_argument("-i", "--input", required=True, help="Input parquet file")
    parser.add_argument("-o", "--output", required=True, help="Output parquet file")
    parser.add_argument("--price-col", default="price", help="Price column name")
    parser.add_argument("--qty-col", default="quantity", help="Quantity column name")
    parser.add_argument("--cost-col", default="cost", help="Cost column name")
    parser.add_argument("--date-col", default="date", help="Date column name")
    parser.add_argument("--ma-col", default=None, help="Column for moving averages")
    parser.add_argument("--ma-windows", default="7,30", help="Comma-separated window sizes")
    args = parser.parse_args()

    df = pd.read_parquet(args.input)
    print(f"Loaded: {args.input} ({len(df)} rows, {len(df.columns)} cols)")

    df = add_revenue_features(df, args.price_col, args.qty_col)
    df = add_margin_features(df, "revenue", args.cost_col)
    df = add_time_features(df, args.date_col)

    if args.ma_col:
        windows = [int(w) for w in args.ma_windows.split(",")]
        df = add_moving_averages(df, args.ma_col, windows, args.date_col)

    df.to_parquet(args.output, index=False)
    print(f"Saved: {args.output} ({len(df)} rows, {len(df.columns)} cols)")


if __name__ == "__main__":
    main()
