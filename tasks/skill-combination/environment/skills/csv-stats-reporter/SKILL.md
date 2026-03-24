---
name: csv-stats-reporter
description: Compute statistical summaries (mean, median, p95, p99, min, max) for numeric columns in a CSV file and output a JSON report.
version: 1.0.0
---

# CSV Stats Reporter

## Skill Summary

Reads a CSV file and computes descriptive statistics for all numeric columns.
Produces a JSON report containing per-column metrics that is useful for
monitoring, anomaly detection, and dashboarding.

## Inputs

| Parameter | Flag       | Required | Description                                              |
|-----------|------------|----------|----------------------------------------------------------|
| input     | `-i`       | Yes      | Path to the input CSV file                               |
| output    | `-o`       | Yes      | Path to the output JSON report                           |
| columns   | `--columns`| No       | Comma-separated list of columns to analyse (default: all)|
| group-by  | `--group-by`| No      | Column name to group statistics by                       |

## Computed Metrics

For each numeric column the following metrics are computed:

- `count` — number of non-null values
- `mean`  — arithmetic mean
- `median` — 50th percentile
- `std`   — standard deviation
- `min` / `max` — extremes
- `p95`   — 95th percentile
- `p99`   — 99th percentile

## Output

A JSON file structured as:

```json
{
  "source": "<input_file>",
  "total_rows": 1234,
  "columns_analysed": ["response_time_ms", "status_code"],
  "stats": {
    "response_time_ms": {
      "count": 1200,
      "mean": 245.3,
      "median": 180.0,
      "std": 312.7,
      "min": 12,
      "max": 4500,
      "p95": 890.0,
      "p99": 2100.0
    }
  }
}
```

When `--group-by` is used, `stats` becomes a nested dict keyed by group value.

## Implementation

```bash
python3 ./skills/csv-stats-reporter/stats_reporter.py -i <input.csv> -o <report.json> \
    [--columns col1,col2] [--group-by col_name]
```

## Dependencies

- Python 3.10+ (standard library only)
