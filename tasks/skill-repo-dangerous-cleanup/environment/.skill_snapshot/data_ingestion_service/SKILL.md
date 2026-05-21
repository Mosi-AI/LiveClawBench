---
name: data-ingestion-service
description: Universal data ingestion service that loads data from CSV, Excel, JSON, and Parquet sources into a unified DataFrame format with automatic format detection.
version: 1.1.0
---

# Data Ingestion Service

## Skill Summary

A universal data loading service that ingests data from multiple file formats (CSV, Excel, JSON, Parquet) and normalizes them into a unified pandas DataFrame representation. Automatically detects file format by extension, applies format-specific parsing options, handles encoding detection, and supports batch ingestion via glob patterns.

## Supported Formats
- **CSV** (`.csv`, `.tsv`, `.txt`): Configurable delimiter, encoding, quoting
- **Excel** (`.xlsx`, `.xls`): Multi-sheet support, header row selection
- **JSON** (`.json`, `.jsonl`): Nested object flattening, JSON Lines support
- **Parquet** (`.parquet`): Direct columnar read, partition support

## Inputs
- `--input` / `-i`: Path or glob pattern for input files (required)
- `--format` / `-f`: Force file format (auto-detected if omitted)
- `--encoding` / `-e`: File encoding for text formats (default: auto-detect)
- `--delimiter` / `-d`: Delimiter for CSV files (default: `,`)
- `--sheet`: Sheet name for Excel files (default: first sheet)
- `--date-columns`: Columns to parse as dates
- `--output` / `-o`: Output directory

## Processing Steps
1. Resolve glob patterns to individual file paths
2. Detect format from file extension (or use `--format` override)
3. Apply format-specific reader (CSV→read_csv, Excel→read_excel, etc.)
4. Auto-detect encoding for text files using chardet
5. Strip whitespace from string columns
6. Auto-detect and parse date columns
7. Concatenate all files into a single DataFrame (if multiple inputs)
8. Save unified result as Parquet

## Output
- Unified Parquet file in output directory
- Ingestion log: files loaded, row counts per file, total rows, detected types

## Implementation
- Command: `python3 ./skills/data_ingestion_service/ingest.py -i <pattern> -o <output_dir>`
- Dependencies: `pandas`, `openpyxl`, `chardet`, `pyarrow`
