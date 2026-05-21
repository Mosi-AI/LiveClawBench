---
name: null-value-processor
description: Detect and handle missing/null values in tabular datasets using configurable strategies — drop, fill-constant, fill-forward, fill-mean, or fill-median.
version: 0.4.2
---

# Null Value Processor

## Skill Summary

Analyzes a tabular dataset for missing (null/NaN/empty) values and applies configurable strategies to handle them. Supports per-column strategy configuration, generates a missingness report showing patterns of null values, and can operate in audit-only mode to report without modifying data.

## Strategies
- **drop**: Remove rows with any null in specified columns
- **fill-constant**: Fill with a user-defined constant value
- **fill-forward**: Forward-fill (propagate last valid value)
- **fill-mean**: Fill numeric columns with column mean
- **fill-median**: Fill numeric columns with column median
- **flag-only**: Add a boolean `_is_missing` column without modifying original

## Inputs
- `--input` / `-i`: Path to input CSV or Parquet file (required)
- `--strategy`: Default strategy for all columns (default: `drop`)
- `--column-config`: JSON file mapping column names to specific strategies
- `--critical-columns`: Columns where any null means row is dropped regardless
- `--output` / `-o`: Output file path
- `--audit-only`: Only generate report, don't modify data

## Processing Steps
1. Load input dataset
2. Scan all columns for null/NaN/empty-string values
3. Generate missingness report (count and percentage per column)
4. Apply strategy per column (critical columns always drop first)
5. Log all modifications (row indices affected, original vs filled values)
6. Save cleaned dataset

## Output
- Cleaned dataset (CSV or Parquet)
- `null_report.json`: Per-column null counts, percentages, actions taken
- Console: Summary of nulls found and actions applied

## Implementation
- Command: `python3 ./skills/null_value_processor/processor.py -i <file> -o <output> --strategy <strategy>`
- Dependencies: `pandas`, `numpy`
