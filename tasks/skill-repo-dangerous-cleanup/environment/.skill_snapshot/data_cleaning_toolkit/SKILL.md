---
name: data-cleaning-toolkit
description: Comprehensive data cleaning toolkit — handles missing values, duplicate removal, type coercion, whitespace trimming, and outlier detection in a single pass over the dataset.
version: 1.2.1
---

# Data Cleaning Toolkit

## Skill Summary

An all-in-one data quality tool that performs multiple cleaning operations in a single pipeline pass. Handles missing value imputation (drop, fill-mean, fill-median, fill-constant), duplicate row detection and removal, automatic type coercion (string-to-numeric, string-to-date), whitespace trimming, and statistical outlier flagging. Generates a comprehensive data quality report.

## Cleaning Operations (executed in order)
1. **Whitespace trimming**: Strip leading/trailing whitespace from all string columns
2. **Type coercion**: Auto-detect and convert mistyped columns (numeric strings → float, date strings → datetime)
3. **Missing value handling**: Apply configurable strategy per column
4. **Deduplication**: Remove exact-match duplicates on specified key columns
5. **Outlier detection**: Flag values beyond ±3 standard deviations or IQR×1.5

## Inputs
- `--input` / `-i`: Path to input file (CSV, Parquet, Excel) (required)
- `--output` / `-o`: Output path for cleaned data
- `--null-strategy`: Strategy for missing values: `drop`, `fill-mean`, `fill-median`, `fill-constant` (default: `drop`)
- `--fill-value`: Constant value for `fill-constant` strategy
- `--dedup-keys`: Columns for deduplication key (comma-separated; default: all columns)
- `--critical-columns`: Columns where nulls always trigger row drop
- `--outlier-method`: `zscore` or `iqr` (default: `zscore`)
- `--no-outlier`: Skip outlier detection

## Processing Steps
1. Load data from input file (auto-detect format)
2. Trim whitespace from all string columns
3. Attempt type coercion on each column
4. Scan for missing values; apply strategy per column
5. Identify and remove duplicates based on key columns
6. Run outlier detection; add `_outlier` flag columns
7. Generate data quality report
8. Save cleaned dataset

## Output
- Cleaned dataset (CSV or Parquet)
- `quality_report.json`: Comprehensive report including:
  - Null counts before/after per column
  - Duplicate rows found and removed
  - Type coercion results
  - Outlier counts per column
  - Row count before/after each stage

## Implementation
- Command: `python3 ./skills/data_cleaning_toolkit/clean.py -i <file> -o <output>`
- Dependencies: `pandas`, `numpy`, `scipy`
