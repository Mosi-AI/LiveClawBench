---
name: data-deduplicator
description: Identify and remove duplicate records from tabular datasets using exact-match, fuzzy-match, or composite-key-based deduplication strategies.
version: 0.5.0
---

# Data Deduplicator

## Skill Summary

Detects and removes duplicate records in tabular data. Supports exact match on all columns, exact match on a subset of key columns (composite key), and fuzzy matching for near-duplicate detection. Reports all duplicates found before removal, keeping configurable occurrence (first, last, or none).

## Deduplication Modes
- **exact-all**: Exact match across all columns
- **exact-key**: Exact match on specified key columns only
- **fuzzy**: Fuzzy string matching on specified columns (Levenshtein distance threshold)

## Inputs
- `--input` / `-i`: Path to input CSV or Parquet (required)
- `--mode`: Deduplication mode (default: `exact-all`)
- `--key-columns` / `-k`: Columns for composite key matching (comma-separated)
- `--keep`: Which duplicate to keep: `first`, `last`, or `none` (default: `first`)
- `--threshold`: Fuzzy matching similarity threshold 0-100 (default: 90)
- `--output` / `-o`: Output path for deduplicated data
- `--report-only`: Only report duplicates without removing

## Processing Steps
1. Load dataset
2. Identify duplicates based on selected mode
3. Group duplicate sets and rank by specified `keep` strategy
4. Generate duplicate report (groups, counts, indices)
5. Remove duplicate rows (keep selected occurrence)
6. Save deduplicated result

## Output
- Deduplicated dataset (CSV or Parquet)
- `duplicates_report.json`: Duplicate groups with row indices, count of removed rows
- Console: Total duplicates found, rows removed

## Implementation
- Command: `python3 ./skills/data_deduplicator/dedup.py -i <file> -o <output> --mode <mode>`
- Dependencies: `pandas`, `fuzzywuzzy` (for fuzzy mode)
