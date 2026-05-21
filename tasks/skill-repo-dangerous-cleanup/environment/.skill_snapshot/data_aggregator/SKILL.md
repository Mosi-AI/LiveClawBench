---
name: data-aggregator
description: Aggregate tabular data by one or more dimensions with configurable metrics — sum, mean, count, min, max, median. Supports multi-level grouping and pivot table generation.
version: 0.8.0
---

# Data Aggregator

## Skill Summary

Performs group-by aggregations on tabular datasets. Supports single and multi-level grouping, configurable aggregate functions (sum, mean, count, min, max, median, std), and pivot table generation for cross-dimensional analysis. Can output flat aggregation tables or pivot matrices.

## Aggregation Modes
- **flat**: Standard group-by → one row per group
- **pivot**: Cross-tabulation with row/column dimensions and value metric
- **rolling**: Time-based rolling window aggregation

## Inputs
- `--input` / `-i`: Path to input file (CSV or Parquet) (required)
- `--group-by` / `-g`: Grouping columns (comma-separated) (required)
- `--metrics`: Aggregation specs like `revenue:sum,quantity:mean,order_id:count`
- `--mode`: `flat`, `pivot`, or `rolling` (default: `flat`)
- `--pivot-columns`: Column for pivot table columns (for pivot mode)
- `--pivot-values`: Value column for pivot table (for pivot mode)
- `--window`: Window size for rolling mode
- `--output` / `-o`: Output path
- `--sort-by`: Sort result by specified column (descending)

## Processing Steps
1. Load dataset
2. Parse metric specifications (column:function pairs)
3. Apply group-by aggregation or pivot
4. Sort results by specified column if provided
5. Calculate group-level subtotals if multi-level grouping
6. Save aggregated result

## Output
- Aggregated dataset (CSV or Parquet)
- Console: Group count, top 10 groups by first metric

## Implementation
- Command: `python3 ./skills/data_aggregator/aggregate.py -i <file> -g <columns> --metrics <specs>`
- Dependencies: `pandas`, `numpy`
