---
name: summary-report-generator
description: Generate comprehensive summary statistics and KPI reports from sales/transaction data — includes total revenue, top products, regional breakdown, channel performance, and time-series trends.
version: 0.4.1
---

# Summary Report Generator

## Skill Summary

Produces a comprehensive summary report from processed sales/transaction data. Calculates key performance indicators (KPIs) like total revenue, average order value, top-selling products, and regional/channel breakdowns. Generates aggregated views across multiple dimensions (time, product, region, channel) and exports as a structured JSON report alongside CSV tables.

## Report Sections
1. **Overview KPIs**: Total revenue, total orders, average order value, total units sold
2. **Time trends**: Daily, weekly, monthly revenue trends
3. **Top products**: Top N products by revenue and by units sold
4. **Regional breakdown**: Revenue and order count by region
5. **Channel performance**: Revenue and order count by sales channel
6. **Category analysis**: Revenue by product category
7. **Cross-dimensional**: Region × Category revenue matrix

## Inputs
- `--input` / `-i`: Path to cleaned transaction data (CSV) (required)
- `--catalog` / `-c`: Path to product catalog JSON (for category info)
- `--output-dir` / `-o`: Output directory for all report files
- `--top-n`: Number of top products to include (default: 10)
- `--time-granularity`: `daily`, `weekly`, or `monthly` (default: all three)

## Processing Steps
1. Load transaction data and product catalog
2. Calculate overview KPIs (totals, averages)
3. Aggregate by time periods (daily/weekly/monthly)
4. Rank products by revenue and units sold
5. Aggregate by region, channel, category
6. Build cross-dimensional pivot (region × category)
7. Compile all sections into structured JSON report
8. Export individual aggregation tables as CSV files

## Output
- `summary_report.json`: Structured JSON with all KPI sections
- `agg_daily.csv`: Daily revenue/quantity trends
- `agg_weekly.csv`: Weekly aggregation
- `agg_monthly.csv`: Monthly aggregation
- `agg_by_product.csv`: Per-product summary
- `agg_by_region.csv`: Regional breakdown
- `agg_by_channel.csv`: Channel performance
- `agg_region_category.csv`: Region × Category pivot

## Implementation
- Command: `python3 ./skills/summary_report_generator/report.py -i <file> -c <catalog> -o <output_dir>`
- Dependencies: `pandas`, `numpy`, `json`
