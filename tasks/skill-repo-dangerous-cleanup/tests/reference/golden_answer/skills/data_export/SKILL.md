---
name: data-export
description: Export datasets to multiple formats — CSV (configurable delimiter, encoding, quoting), JSON (records/nested/lines), Parquet (compressed), and Excel (.xlsx with formatting). Supports batch export and ZIP packaging.
version: 1.0.0
---

# Data Export

## Skill Summary

Versatile data export tool that writes datasets to one or multiple file formats in a single invocation. Supports CSV (with fine-grained formatting control), JSON (multiple orientations), Parquet (with compression), and Excel (.xlsx with optional formatting). Handles batch export of multiple datasets and can package outputs into a ZIP archive.

Merges functionality from: `csv_export_writer`, `multi_format_exporter`.

## Supported Output Formats
- **CSV**: Configurable delimiter, encoding (utf-8, utf-8-sig, latin-1), quoting style (minimal, all, nonnumeric, none), column ordering, float formatting, NA representation
- **JSON**: Records, columns, or split orientation; JSON Lines; configurable indentation
- **Parquet**: Columnar with compression (snappy, gzip, zstd)
- **Excel**: .xlsx with optional sheet naming, column width auto-fit, header formatting

## Inputs
- `--input` / `-i`: Path(s) to input data file(s) (required)
- `--output` / `-o`: Output file path or directory (required)
- `--formats` / `-f`: Comma-separated formats: `csv,json,parquet,excel` (default: `csv`)
- `--base-name`: Base filename for multi-format output
- `--delimiter` / `-d`: CSV delimiter (default: `,`)
- `--encoding` / `-e`: CSV encoding (default: `utf-8-sig`)
- `--quoting`: CSV quoting: `minimal`, `all`, `nonnumeric`, `none`
- `--columns`: Column selection and ordering (comma-separated)
- `--float-format`: Float format string (e.g., `%.2f`)
- `--na-rep`: Missing value representation (default: empty)
- `--json-orient`: JSON orientation: `records`, `columns`, `split`
- `--json-indent`: JSON indentation (default: 2)
- `--parquet-compression`: `snappy`, `gzip`, `zstd` (default: `snappy`)
- `--zip`: Package all outputs into ZIP
- `--no-header`: Omit CSV header row
- `--no-index`: Omit row index (default: true)

## Output
- Output file(s) in specified format(s)
- `export_manifest.json`: List of exported files with sizes and checksums
- Optional: `export_bundle.zip` containing all outputs
- Console: Files written, sizes, row/column counts

## Implementation
- Command: `python3 ./skills/data_export/export.py -i <input> -o <output_dir> -f csv,json`
- Dependencies: `pandas`, `pyarrow`, `openpyxl`
