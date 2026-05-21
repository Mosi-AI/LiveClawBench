---
name: sales-data-pipeline
description: End-to-end ETL pipeline for retail sales data — ingests CSV transactions, cleans and validates data against product catalog, computes derived metrics (revenue, margin, moving averages), aggregates by multiple dimensions, and exports results in CSV/JSON formats with a summary report.
version: 1.0.0
---

# Sales Data Pipeline

## Skill Summary

A complete ETL (Extract-Transform-Load) pipeline for processing retail sales transaction data. The pipeline reads raw CSV transaction files and a JSON product catalog, performs data cleaning (null handling, deduplication, type coercion), validates records against business rules and the product catalog schema, calculates derived financial metrics, aggregates data by time/product/region dimensions, and exports cleaned data plus summary reports.

## Pipeline Stages

### 1. Data Ingestion
- Load CSV transaction files with configurable encoding and delimiter
- Load JSON product catalog for reference lookups
- Support glob patterns for batch file ingestion (e.g., `sales_*.csv`)
- Parse dates and numeric fields with error handling

### 2. Data Cleaning
- **Missing values**: Drop rows where critical fields (`product_id`, `quantity`) are empty; fill optional fields with defaults
- **Deduplication**: Identify and remove duplicate records based on (`date`, `product_id`, `quantity`, `unit_price`, `region`) composite key
- **Type coercion**: Convert `quantity` to integer, `unit_price` to float, `date` to datetime
- **Outlier flagging**: Flag negative prices and zero quantities as data entry errors

### 3. Data Validation
- **Schema validation**: Verify required columns exist and types are correct
- **Catalog lookup**: Cross-reference `product_id` against product catalog; flag unknown IDs
- **Business rules**: `quantity > 0`, `unit_price > 0`, `date` within expected range
- **Validation report**: Generate a JSON report listing all rejected records with rejection reasons

### 4. Data Transformation
- **Revenue calculation**: `revenue = quantity * unit_price`
- **Margin calculation**: Join with product catalog to get `unit_cost`, compute `margin = revenue - (quantity * unit_cost)`, `margin_pct = margin / revenue`
- **Time features**: Extract `year`, `month`, `weekday`, `week_number` from date
- **7-day moving average**: Compute rolling 7-day revenue moving average per product

### 5. Data Aggregation
- **By time**: Daily, weekly, monthly revenue/quantity totals
- **By product**: Total revenue, units sold, average price per product
- **By region**: Regional performance breakdown
- **By channel**: Online vs retail vs wholesale comparison
- **Cross-dimensional**: Region × Category matrix

### 6. Export & Reporting
- **Cleaned data**: Export full cleaned dataset as CSV
- **Aggregation tables**: Export each aggregation as separate CSV files
- **Summary report**: JSON report with KPIs — total revenue, top products, growth trends
- **Validation report**: JSON listing of rejected records with reasons

## Inputs
- `--input-csv` / `-i`: Path to raw transaction CSV file(s), supports glob
- `--catalog` / `-c`: Path to product catalog JSON
- `--output-dir` / `-o`: Output directory for all generated files
- `--date-range`: Optional date filter (`YYYY-MM-DD:YYYY-MM-DD`)
- `--config`: Optional YAML config for pipeline parameters

## Output Files
- `cleaned_transactions.csv` — Validated, cleaned transaction records
- `rejected_records.json` — Records that failed validation with reasons
- `agg_daily.csv` — Daily aggregation
- `agg_weekly.csv` — Weekly aggregation
- `agg_monthly.csv` — Monthly aggregation
- `agg_by_product.csv` — Per-product summary
- `agg_by_region.csv` — Per-region summary
- `agg_by_channel.csv` — Per-channel summary
- `agg_region_category.csv` — Region × Category cross-tab
- `summary_report.json` — KPI summary report

## Implementation
- Command: `python3 ./skills/sales_data_pipeline/pipeline.py -i <csv> -c <catalog> -o <output_dir>`
- Dependencies: `pandas`, `numpy` (standard data stack)
