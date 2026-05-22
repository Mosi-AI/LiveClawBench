---
name: data-ingestion
description: Universal data ingestion — loads CSV, Excel, JSON, and Parquet files into unified DataFrames with auto-detection of format, encoding, and date columns. Supports glob patterns for batch loading.
version: 1.0.0
---

# Data Ingestion

## Skill Summary

Consolidated data loading service that ingests data from all common tabular formats (CSV, Excel/xlsx/xls, JSON/JSONL, Parquet) and normalizes them into pandas DataFrames. Auto-detects file format by extension, handles encoding detection (chardet), parses date columns, strips whitespace from string fields, and supports batch ingestion via glob patterns.

Merges functionality from: `csv_data_loader`, `excel_data_reader`, `data_ingestion_service`.

## Supported Formats
- **CSV** (`.csv`, `.tsv`, `.txt`): Configurable delimiter, encoding, quoting
- **Excel** (`.xlsx`, `.xls`): Multi-sheet support via openpyxl/xlrd, header row selection
- **JSON** (`.json`, `.jsonl`): Nested object flattening, JSON Lines support
- **Parquet** (`.parquet`): Direct columnar read with partition support

## Inputs
- `--input` / `-i`: Path or glob pattern for input files (required)
- `--format` / `-f`: Force file format (auto-detected if omitted)
- `--encoding` / `-e`: File encoding for text formats (default: auto-detect via chardet)
- `--delimiter` / `-d`: Delimiter for CSV files (default: `,`)
- `--sheet`: Sheet name/index for Excel files (default: first sheet; `all` for all sheets)
- `--date-columns`: Columns to parse as datetime
- `--output` / `-o`: Output directory

## Processing Steps
1. Resolve glob patterns to file list
2. Detect format per file (by extension or `--format` override)
3. Apply format-specific reader with encoding detection
4. Strip whitespace from string columns
5. Auto-detect and parse date columns (ISO 8601, US, EU formats)
6. Concatenate multiple files into unified DataFrame
7. Save result as Parquet

## Output
- Unified Parquet file in output directory
- Console: files loaded, row counts per file, column types

## Implementation
- Command: `python3 ./skills/data_ingestion/ingest.py -i <pattern> -o <output_dir>`
- Dependencies: `pandas`, `openpyxl`, `xlrd`, `chardet`, `pyarrow`
