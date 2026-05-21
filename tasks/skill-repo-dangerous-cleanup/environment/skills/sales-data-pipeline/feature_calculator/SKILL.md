---
name: feature-calculator
description: Calculate derived columns and financial metrics from transaction data — revenue, profit margin, time-based features, moving averages, and growth rates.
version: 0.7.0
---

# Feature Calculator

## Skill Summary

Computes derived features and financial metrics from raw transaction data. Handles common calculations like revenue (quantity × price), profit margin (using cost lookup), time-based feature extraction (month, weekday, week number), rolling window aggregates (moving averages), and period-over-period growth rates. Designed for retail/e-commerce transaction pipelines.

## Available Calculations
- **revenue**: `quantity * unit_price`
- **cost_total**: `quantity * unit_cost` (requires cost lookup)
- **margin**: `revenue - cost_total`
- **margin_pct**: `margin / revenue * 100`
- **time_features**: Extract `year`, `month`, `weekday`, `week_number` from a date column
- **moving_avg**: Rolling N-day moving average of a numeric column
- **growth_rate**: Period-over-period percentage change
- **cumulative_sum**: Running cumulative total
- **rank**: Rank within a group (e.g., rank products by revenue)

## Inputs
- `--input` / `-i`: Path to transaction data (CSV or Parquet) (required)
- `--features`: Comma-separated list of features to calculate (default: all)
- `--cost-lookup`: Path to product catalog/cost lookup JSON
- `--date-column`: Column name containing dates (default: `date`)
- `--window`: Rolling window size in days for moving average (default: 7)
- `--group-by`: Column for group-level calculations
- `--output` / `-o`: Output path

## Processing Steps
1. Load transaction data
2. Parse date column to datetime
3. Calculate requested features:
   - Arithmetic: revenue, cost, margin
   - Temporal: extract date components
   - Rolling: compute moving averages per group
   - Growth: calculate period-over-period changes
4. Join with cost lookup if margin calculations requested
5. Save enriched dataset

## Output
- Enriched dataset with new columns appended (CSV or Parquet)
- `feature_summary.json`: Statistics for each computed feature (min, max, mean, null count)
- Console: List of features calculated, row count

## Implementation
- Command: `python3 ./skills/feature_calculator/calculate.py -i <file> -o <output> --features <list>`
- Dependencies: `pandas`, `numpy`
