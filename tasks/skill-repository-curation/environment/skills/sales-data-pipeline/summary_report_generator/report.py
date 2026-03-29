"""Summary Report Generator - Generate KPI summary with revenue, top products, regional breakdown."""

import argparse
import json
import pandas as pd


def generate_report(
    df,
    revenue_col="revenue",
    product_col="product",
    region_col="region",
    date_col="date",
    top_n=5,
):
    """Generate a KPI summary report from the data."""
    report = {"row_count": len(df), "column_count": len(df.columns)}

    # Revenue KPIs
    if revenue_col in df.columns:
        report["revenue"] = {
            "total": float(df[revenue_col].sum()),
            "mean": float(df[revenue_col].mean()),
            "median": float(df[revenue_col].median()),
            "min": float(df[revenue_col].min()),
            "max": float(df[revenue_col].max()),
        }

    # Top products by revenue
    if product_col in df.columns and revenue_col in df.columns:
        top = df.groupby(product_col)[revenue_col].sum().nlargest(top_n)
        report["top_products"] = {str(k): float(v) for k, v in top.items()}

    # Regional breakdown
    if region_col in df.columns and revenue_col in df.columns:
        regional = df.groupby(region_col)[revenue_col].agg(["sum", "mean", "count"])
        report["regional_breakdown"] = {
            str(region): {
                "total": float(row["sum"]),
                "mean": float(row["mean"]),
                "count": int(row["count"]),
            }
            for region, row in regional.iterrows()
        }

    # Time trends (monthly)
    if date_col in df.columns and revenue_col in df.columns:
        df["_month"] = pd.to_datetime(df[date_col], errors="coerce").dt.to_period("M")
        monthly = df.groupby("_month")[revenue_col].sum()
        report["monthly_trend"] = {str(k): float(v) for k, v in monthly.items()}
        df = df.drop(columns=["_month"])

    return report


def main():
    parser = argparse.ArgumentParser(description="Generate KPI summary report")
    parser.add_argument("-i", "--input", required=True, help="Input parquet file")
    parser.add_argument("-o", "--output", required=True, help="Output report (JSON)")
    parser.add_argument("--revenue-col", default="revenue", help="Revenue column")
    parser.add_argument("--product-col", default="product", help="Product column")
    parser.add_argument("--region-col", default="region", help="Region column")
    parser.add_argument("--date-col", default="date", help="Date column")
    parser.add_argument("--top-n", type=int, default=5, help="Number of top products")
    args = parser.parse_args()

    df = pd.read_parquet(args.input)
    print(f"Loaded: {args.input} ({len(df)} rows)")

    report = generate_report(
        df,
        args.revenue_col,
        args.product_col,
        args.region_col,
        args.date_col,
        args.top_n,
    )

    with open(args.output, "w") as f:
        json.dump(report, f, indent=2, default=str)

    print(f"Report generated: {args.output}")
    if "revenue" in report:
        r = report["revenue"]
        print(f"  Total revenue: {r['total']:,.2f}")
        print(f"  Mean revenue: {r['mean']:,.2f}")
    if "top_products" in report:
        print(
            f"  Top {len(report['top_products'])} products: {list(report['top_products'].keys())}"
        )
    if "regional_breakdown" in report:
        print(f"  Regions: {list(report['regional_breakdown'].keys())}")


if __name__ == "__main__":
    main()
