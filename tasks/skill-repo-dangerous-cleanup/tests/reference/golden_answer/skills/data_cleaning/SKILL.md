---
name: data-cleaning
description: Comprehensive data cleaning — handles missing/null values (drop, fill-mean, fill-median, fill-constant), deduplication (exact and fuzzy), type coercion, whitespace trimming, and outlier detection in a single pass.
version: 1.0.0
---

# Data Cleaning

## Skill Summary

All-in-one data quality tool performing multiple cleaning operations in a single pipeline pass. Handles missing value imputation (configurable per-column strategy), duplicate row detection and removal (exact-match and fuzzy-match), automatic type coercion (string→numeric, string→date), whitespace trimming, and statistical outlier flagging. Generates comprehensive data quality reports.

Merges functionality from: `null_value_processor`, `data_deduplicator`, `data_cleaning_toolkit`.

## Cleaning Operations (in order)
1. **Whitespace trimming**: Strip leading/trailing whitespace from all string columns
2. **Type coercion**: Auto-detect and convert mistyped columns (numeric strings → float, date strings → datetime)
3. **Missing value handling**: Configurable strategy per column — `drop`, `fill-mean`, `fill-median`, `fill-constant`, `fill-forward`, `flag-only`
4. **Deduplication**: Remove duplicates by exact-all, exact-key (composite key), or fuzzy match (Levenshtein threshold)
5. **Outlier detection**: Flag values beyond ±3σ (z-score) or IQR×1.5

## Inputs
- `--input` / `-i`: Path to input file (CSV, Parquet, Excel) (required)
- `--output` / `-o`: Output path for cleaned data
- `--null-strategy`: Default strategy for missing values (default: `drop`)
- `--critical-columns`: Columns where nulls always trigger row drop
- `--column-config`: JSON mapping columns to specific null strategies
- `--dedup-mode`: `exact-all`, `exact-key`, or `fuzzy` (default: `exact-all`)
- `--dedup-keys`: Columns for composite key matching
- `--keep`: Which duplicate to keep: `first`, `last`, `none` (default: `first`)
- `--fuzzy-threshold`: Similarity threshold 0-100 for fuzzy mode (default: 90)
- `--outlier-method`: `zscore` or `iqr` (default: `zscore`)
- `--no-outlier`: Skip outlier detection
- `--audit-only`: Only report without modifying data

## Output
- Cleaned dataset (CSV or Parquet)
- `quality_report.json`: Null counts before/after, duplicates found/removed, type coercion results, outlier counts, row counts at each stage
- `null_report.json`: Per-column null analysis
- `duplicates_report.json`: Duplicate group details

## Implementation
- Command: `python3 ./skills/data_cleaning/clean.py -i <file> -o <output>`
- Dependencies: `pandas`, `numpy`, `scipy`, `fuzzywuzzy`
