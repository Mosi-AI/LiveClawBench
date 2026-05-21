---
name: multi-format-exporter
description: Export datasets to multiple output formats in one invocation — CSV, JSON, Parquet, and Excel. Supports per-format configuration, batch export of multiple DataFrames, and ZIP packaging.
version: 0.5.0
---

# Multi-Format Exporter

## Skill Summary

A versatile data export tool that writes datasets to multiple file formats simultaneously. In a single invocation, can output the same data as CSV, JSON (records or nested), Parquet (columnar), and Excel (.xlsx with optional formatting). Supports batch mode for exporting multiple datasets at once, and can package all outputs into a ZIP archive.

## Supported Output Formats
- **CSV**: Configurable delimiter, encoding, quoting (same options as csv-export-writer)
- **JSON**: Records orientation, nested objects, JSON Lines, pretty-printed
- **Parquet**: Columnar format with compression (snappy, gzip, zstd)
- **Excel**: .xlsx with optional sheet naming, column width auto-fit, header formatting

## Inputs
- `--input` / `-i`: Path(s) to input data file(s) (required)
- `--output-dir` / `-o`: Output directory (required)
- `--formats` / `-f`: Comma-separated output formats: `csv,json,parquet,excel` (default: `csv`)
- `--base-name`: Base filename for outputs (default: derived from input)
- `--csv-delimiter`: Delimiter for CSV output (default: `,`)
- `--csv-encoding`: Encoding for CSV output (default: `utf-8`)
- `--json-orient`: JSON orientation: `records`, `columns`, `split` (default: `records`)
- `--json-indent`: JSON indentation (default: 2)
- `--parquet-compression`: Compression for Parquet: `snappy`, `gzip`, `zstd` (default: `snappy`)
- `--zip`: Package all outputs into a ZIP file
- `--float-format`: Format for float columns in CSV (e.g., `%.2f`)

## Processing Steps
1. Load input data file(s)
2. For each requested format:
   - Apply format-specific configuration
   - Write output file with appropriate extension
3. Optionally package all outputs into a ZIP archive
4. Generate export manifest

## Output
- One file per format in output directory (e.g., `data.csv`, `data.json`, `data.parquet`, `data.xlsx`)
- `export_manifest.json`: List of exported files with sizes and checksums
- Optional: `export_bundle.zip` containing all outputs
- Console: Files exported, sizes, formats

## Implementation
- Command: `python3 ./skills/multi_format_exporter/export.py -i <file> -o <output_dir> -f csv,json`
- Dependencies: `pandas`, `pyarrow`, `openpyxl`
