---
name: excel-data-reader
description: Read and parse Excel workbooks (.xlsx/.xls) with support for multiple sheets, named ranges, and automatic type inference.
version: 0.2.0
---

# Excel Data Reader

## Skill Summary

Reads Excel workbook files (.xlsx and .xls formats) and converts them to pandas DataFrames. Supports selecting specific sheets by name or index, reading named ranges, and automatic type inference for numeric and date columns. Can process multiple sheets in a single invocation and output each as a separate file.

## Inputs
- `--input` / `-i`: Path to Excel file (required)
- `--sheet`: Sheet name or index (default: first sheet; use `all` for all sheets)
- `--header-row`: Row number containing headers (default: 0)
- `--date-columns`: Columns to force-parse as dates
- `--output` / `-o`: Output directory

## Processing Steps
1. Open workbook with openpyxl (xlsx) or xlrd (xls)
2. Read specified sheet(s) into DataFrames
3. Infer column types: detect numeric strings, date patterns
4. Strip whitespace from string columns
5. Auto-detect date columns by checking common patterns
6. Export each sheet as a separate Parquet file

## Output
- One Parquet file per sheet in output directory
- Console summary: sheets found, row counts, column types

## Implementation
- Command: `python3 ./skills/excel_data_reader/reader.py -i <file> -o <output_dir>`
- Dependencies: `pandas`, `openpyxl`, `xlrd`
