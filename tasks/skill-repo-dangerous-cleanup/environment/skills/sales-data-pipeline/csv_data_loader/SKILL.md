---
name: csv-data-loader
description: Load and parse CSV files into structured data frames with configurable encoding, delimiter, and date parsing options.
version: 0.3.1
---

# CSV Data Loader

## Skill Summary

Reads CSV files from disk and parses them into pandas DataFrames. Supports configurable delimiters (comma, tab, semicolon), file encodings (UTF-8, Latin-1, GBK), and automatic date column detection. Handles common CSV quirks like BOM markers, inconsistent quoting, and mixed line endings.

## Inputs
- `--input` / `-i`: Path to CSV file (required)
- `--delimiter` / `-d`: Column delimiter (default: `,`)
- `--encoding` / `-e`: File encoding (default: `utf-8`)
- `--date-columns`: Comma-separated list of columns to parse as dates
- `--output` / `-o`: Output directory for parsed result (Parquet format)

## Processing Steps
1. Detect file encoding if not specified (chardet fallback)
2. Read CSV with pandas `read_csv`, applying delimiter and encoding
3. Strip leading/trailing whitespace from string columns
4. Auto-detect and parse date columns (ISO 8601, US, EU formats)
5. Report column types and row count

## Output
- Parsed DataFrame saved as Parquet file in output directory
- Console summary: row count, column names and dtypes, detected date columns

## Implementation
- Command: `python3 ./skills/csv_data_loader/loader.py -i <file> -o <output_dir>`
- Dependencies: `pandas`, `chardet`
