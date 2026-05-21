---
name: data-aggregation-and-reporting
description: Aggregate data by multiple dimensions (time, product, region, channel) with configurable metrics, pivot tables, and generate KPI summary reports with top products, trends, and cross-dimensional breakdowns.
version: 1.0.0
---

# Data Aggregation & Reporting

## Skill Summary

Performs group-by aggregations across multiple dimensions and generates comprehensive KPI summary reports. Supports flat aggregation, pivot table generation, rolling window aggregation, and pre-built sales reporting templates (daily/weekly/monthly trends, top products, regional/channel breakdowns, category analysis).

Merges functionality from: `data_aggregator`, `summary_report_generator`.

## Aggregation Modes
- **Flat**: Standard group-by with configurable metrics (sum, mean, count, min, max, median, std)
- **Pivot**: Cross-tabulation with row/column dimensions
- **Rolling**: Time-based rolling window aggregation

## Report Sections (for sales data)
1. **Overview KPIs**: Total revenue, total orders, average order value, total units
2. **Time trends**: Daily, weekly, monthly revenue and quantity
3. **Top products**: Top N by revenue and by units sold
4. **Regional breakdown**: Revenue and orders by region
5. **Channel performance**: Online vs retail vs wholesale
6. **Category analysis**: Revenue by product category
7. **Cross-dimensional**: Region × Category revenue matrix

## Inputs
- `--input` / `-i`: Path to input data (CSV or Parquet) (required)
- `--group-by` / `-g`: Grouping columns (comma-separated)
- `--metrics`: Metric specs like `revenue:sum,quantity:mean,order_id:count`
- `--mode`: `flat`, `pivot`, `rolling`, or `report` (default: `flat`)
- `--pivot-columns`: Column for pivot columns
- `--pivot-values`: Value column for pivot
- `--window`: Window size for rolling mode
- `--catalog` / `-c`: Product catalog JSON (for category info in report mode)
- `--top-n`: Number of top items in report (default: 10)
- `--time-granularity`: `daily`, `weekly`, `monthly` (default: all)
- `--output` / `-o`: Output directory
- `--sort-by`: Sort by column (descending)

## Output
- **Flat/Pivot/Rolling mode**: Aggregated dataset (CSV or Parquet)
- **Report mode**:
  - `summary_report.json`: KPI summary with all sections
  - `agg_daily.csv`, `agg_weekly.csv`, `agg_monthly.csv`: Time aggregations
  - `agg_by_product.csv`: Per-product summary
  - `agg_by_region.csv`: Regional breakdown
  - `agg_by_channel.csv`: Channel performance
  - `agg_region_category.csv`: Region × Category pivot

## Implementation
- Command: `python3 ./skills/data_aggregation_and_reporting/aggregate.py -i <file> -o <output_dir>`
- Dependencies: `pandas`, `numpy`
