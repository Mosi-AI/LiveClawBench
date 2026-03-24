---
name: column-calculator
description: Compute derived columns from existing data using arithmetic operations (sum, diff, multiply) and analytical functions (percentage, cumulative_sum, rank).
version: 1.1.0
---

# Column Calculator

## Skill Summary

Takes a JSON records file and computes a new derived column by applying an arithmetic or
analytical operation to one or two existing columns. Supports three arithmetic operations
(sum, diff, multiply) and three analytical operations (percentage, cumulative_sum, rank).

Note: the `ratio` calculation type has been removed as of v1.1.0. Use `percentage` for
proportional calculations or compute division manually in a pre-processing step.

## Inputs

- `--input` / `-i`: Path to JSON records file (required)
- `--calc`: Calculation type: `sum`, `diff`, `multiply`, `percentage`, `cumulative_sum`, `rank` (required)
- `--columns`: Source column name(s), comma-separated. Two columns for sum/diff/multiply/percentage; one column for cumulative_sum/rank (required)
- `--result-name`: Name for the new column (default: `calculated`)
- `--rank-method`: Ranking method: `dense`, `min`, `max` (default: `dense`; only used with `rank`)
- `--output` / `-o`: Output directory (required)

## Calculation Types

| Type              | Formula / Behavior                          | Columns Required | Notes                                |
| ----------------- | ------------------------------------------- | ---------------- | ------------------------------------ |
| `sum`             | `col_a + col_b`                             | 2                | Numeric addition                     |
| `diff`            | `col_a - col_b`                             | 2                | Numeric subtraction                  |
| `multiply`        | `col_a * col_b`                             | 2                | Numeric multiplication               |
| `percentage`      | `col_a / (col_a + col_b) * 100`             | 2                | Percentage of first in total         |
| `cumulative_sum`  | Running sum of column values in row order   | 1                | Cumulative / running total           |
| `rank`            | Rank of each value (configurable method)    | 1                | Uses `--rank-method` for tie-breaking|

## Rank Methods

- `dense`: No gaps in rank values (1, 2, 2, 3)
- `min`: Tied values get the minimum rank (1, 2, 2, 4)
- `max`: Tied values get the maximum rank (1, 3, 3, 4)

## Processing Steps

1. Load JSON records from input file
2. For arithmetic operations: extract two source column values as floats, apply operation
3. For cumulative_sum: iterate rows in order, accumulate running total
4. For rank: sort values, assign ranks using the specified method
5. Add the result as a new column to each record
6. Write updated records to `transformed_data.json`

## Output

- `transformed_data.json`: Input records with new derived column appended

## Implementation

- Command: `python3 column-calculator/calculator.py -i <file> --calc rank --columns revenue --rank-method dense -o <dir>`
- Dependencies: Python standard library (`json`, `argparse`, `os`)
