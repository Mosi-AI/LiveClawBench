---
name: data-transformation
description: Transform and enrich tabular data — numeric normalization (min-max, z-score, robust scaling), financial metric calculation (revenue, margin), time feature extraction, moving averages, growth rates, and derived column computation.
version: 1.0.0
---

# Data Transformation

## Skill Summary

Computes derived features, financial metrics, and applies numeric transformations to tabular datasets. Combines numeric normalization/scaling with domain-specific feature engineering: revenue calculation, profit margin computation (via cost lookup), time-based feature extraction, rolling window aggregates, and period-over-period growth rates.

Merges functionality from: `numeric_normalizer`, `feature_calculator`.

## Transformation Categories

### Numeric Normalization
- **Min-max scaling**: `(x - min) / (max - min)` → [0, 1]
- **Z-score standardization**: `(x - mean) / std` → mean=0, std=1
- **Robust scaling**: `(x - median) / IQR` → outlier-resistant
- **Log transform**: `log(x + 1)` → for right-skewed data
- **Max-abs scaling**: `x / max(|x|)` → [-1, 1]
- Save/load scaler parameters for reproducible transforms

### Financial Metrics
- **Revenue**: `quantity * unit_price`
- **Cost total**: `quantity * unit_cost` (via catalog lookup)
- **Margin**: `revenue - cost_total`
- **Margin percentage**: `margin / revenue * 100`

### Time Features
- Extract `year`, `month`, `weekday`, `week_number` from date columns
- **Moving average**: Rolling N-day window per group
- **Growth rate**: Period-over-period percentage change
- **Cumulative sum**: Running total

### Ranking
- Rank within groups (e.g., products by revenue)

## Inputs
- `--input` / `-i`: Path to dataset (CSV or Parquet) (required)
- `--features`: Comma-separated feature list (default: all)
- `--normalize-columns`: Columns to normalize
- `--normalize-method`: `min-max`, `z-score`, `robust`, `log`, `max-abs` (default: `min-max`)
- `--cost-lookup`: Path to product catalog JSON for margin calculations
- `--date-column`: Column containing dates (default: `date`)
- `--window`: Rolling window size in days (default: 7)
- `--group-by`: Column for group-level calculations
- `--output` / `-o`: Output path
- `--save-params`: Save scaler parameters to JSON
- `--load-params`: Load saved scaler parameters

## Output
- Enriched dataset with new columns (CSV or Parquet)
- `scaler_params.json` (optional): Fitted normalization parameters
- `feature_summary.json`: Statistics for computed features

## Implementation
- Command: `python3 ./skills/data_transformation/transform.py -i <file> -o <output>`
- Dependencies: `pandas`, `numpy`, `scikit-learn`
