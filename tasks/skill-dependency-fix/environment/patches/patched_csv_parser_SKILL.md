---
name: csv-parser
description: Parse CSV files into structured records with configurable delimiter (comma, tab, pipe, semicolon), custom quote character, encoding, and comment-line skipping.
version: 1.1.0
---

# CSV Parser

## Skill Summary

Reads CSV files and converts them into a list of dictionaries (records). Supports four delimiter
types: comma, tab, pipe, and semicolon. Allows custom quote characters and can skip comment lines
(lines starting with a configurable prefix). Configurable file encoding (defaults to UTF-8) with
automatic header detection from the first non-comment row.

## Inputs

- `--input` / `-i`: Path to CSV file (required)
- `--delimiter` / `-d`: Column delimiter: `,`, `\t`, `|`, or `;` (default: `,`)
- `--encoding` / `-e`: File encoding (default: `utf-8`)
- `--quote-char` / `-q`: Quote character for fields containing delimiters (default: `"`)
- `--comment-prefix`: Skip lines starting with this prefix (default: `#`)
- `--output` / `-o`: Output directory (required)

## Processing Steps

1. Open file with specified encoding
2. Skip lines starting with the comment prefix
3. Read header row to determine column names
4. Parse each subsequent row using the configured delimiter and quote character
5. Attempt numeric conversion for values that look like numbers
6. Write records list to `parsed_data.json`

## Output

- `parsed_data.json`: JSON array of record objects
- Console summary: row count, skipped comment lines, column names, detected numeric columns

## Implementation

- Command: `python3 csv-parser/parser.py -i <file> -d "|" -q "'" --comment-prefix "//" -o <output_dir>`
- Dependencies: Python standard library (`csv`, `json`, `argparse`, `os`)
