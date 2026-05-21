---
name: csv-export-writer
description: Export pandas DataFrames or processed datasets to well-formatted CSV files with configurable encoding, delimiter, quoting, and column ordering.
version: 0.2.0
---

# CSV Export Writer

## Skill Summary

Writes tabular data (pandas DataFrames) to CSV files with fine-grained control over output formatting. Supports configurable delimiter, quoting style, encoding, column ordering, header customization, and optional row-number indexing. Handles special characters and Unicode content correctly.

## Inputs
- `--input` / `-i`: Path to input data file (Parquet, CSV, or Excel) (required)
- `--output` / `-o`: Output CSV file path (required)
- `--delimiter` / `-d`: Output delimiter (default: `,`)
- `--encoding` / `-e`: Output encoding (default: `utf-8-sig` for Excel compatibility)
- `--quoting`: Quoting style: `minimal`, `all`, `nonnumeric`, `none` (default: `minimal`)
- `--columns`: Columns to include and their order (comma-separated; default: all)
- `--no-header`: Omit header row
- `--no-index`: Omit row index (default: true)
- `--float-format`: Format string for float columns (e.g., `%.2f`)
- `--na-rep`: String representation for missing values (default: empty)

## Processing Steps
1. Load input data
2. Select and reorder columns if specified
3. Apply float formatting
4. Write CSV with specified options (delimiter, encoding, quoting)
5. Report file size and row/column counts

## Output
- CSV file at specified output path
- Console: Rows written, file size, encoding used

## Implementation
- Command: `python3 ./skills/csv_export_writer/export.py -i <input> -o <output>`
- Dependencies: `pandas`
