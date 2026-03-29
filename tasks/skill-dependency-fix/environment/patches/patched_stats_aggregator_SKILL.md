---
name: stats-aggregator
description: Compute aggregate statistics (mean, median, sum, count, min, max, percentile, mode) grouped by a column, with configurable percentiles and output metadata.
version: 1.1.0
---

# Stats Aggregator

## Skill Summary

Groups records by a specified column and computes configurable aggregate statistics on a
numeric value column. Supports eight statistical metrics: mean, median, sum, count, min, max,
plus new percentile and mode calculations. Percentiles are configurable via `--percentiles`.

The output now includes a `metadata` section with computation timestamp, total row count,
group count, and aggregation dimensions.

## Inputs

- `--input` / `-i`: Path to JSON records file (required)
- `--group-by` / `-g`: Column name to group records by (required)
- `--value-column` / `-v`: Numeric column to aggregate (required)
- `--metrics`: Comma-separated metrics to compute (default: `mean,median,sum,count,min,max`)
- `--percentiles`: Comma-separated percentile values for percentile metric, e.g. `10,25,50,75,90` (default: `25,75`)
- `--output` / `-o`: Output directory (required)

## Available Metrics

| Metric       | Description                        | Python Function             |
| ------------ | ---------------------------------- | --------------------------- |
| `mean`       | Arithmetic mean                    | `statistics.mean()`         |
| `median`     | Middle value                       | `statistics.median()`       |
| `sum`        | Sum of all values                  | `sum()`                     |
| `count`      | Number of records                  | `len()`                     |
| `min`        | Minimum value                      | `min()`                     |
| `max`        | Maximum value                      | `max()`                     |
| `percentile` | Configurable percentile values     | sorted index interpolation  |
| `mode`       | Most frequently occurring value    | `statistics.mode()`         |

## Processing Steps

1. Load JSON records from input file
2. Group records by the specified column
3. For each group, extract the value column as a list of floats
4. Compute each requested metric (for percentile, compute all configured percentile values)
5. Build metadata section with timestamp, row count, group count, dimensions
6. Write results to `stats_report.json`

## Output

- `stats_report.json` with updated structure:
  ```json
  {
    "group_column": "region",
    "metadata": {
      "timestamp": "2024-01-15T10:30:00",
      "total_rows": 100,
      "group_count": 4,
      "value_column": "revenue",
      "metrics_computed": ["mean", "median", "sum", "count", "min", "max", "percentile", "mode"]
    },
    "groups": {
      "North": {
        "mean": 150.5,
        "median": 140.0,
        "sum": 3010,
        "count": 20,
        "min": 80,
        "max": 250,
        "percentile_25": 110.0,
        "percentile_75": 190.0,
        "mode": 120
      },
      ...
    }
  }
  ```

## Implementation

- Command: `python3 stats-aggregator/aggregator.py -i <file> -g region -v revenue --metrics mean,median,percentile --percentiles 10,25,75,90 -o <dir>`
- Dependencies: Python standard library (`json`, `statistics`, `argparse`, `os`, `datetime`)
