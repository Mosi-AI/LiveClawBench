---
name: log-health-analyzer
description: Composite pipeline skill that chains log-parser and csv-stats-reporter to filter JSONL logs and compute response-time statistics in a single step.
version: 1.0.0
---

# Log Health Analyzer

## Skill Summary

A composite pipeline skill that orchestrates two existing skills — **log-parser**
and **csv-stats-reporter** — into a single unified workflow. Given a JSONL server
log file, this skill:

1. Filters events by time range and severity level (via log-parser)
2. Computes descriptive statistics on numeric columns like response_time_ms
   (via csv-stats-reporter)

This eliminates the repetitive two-step manual process of parsing logs then
running statistics separately.

## Sub-Skills Composed

| Order | Skill              | Role                               |
|-------|--------------------|-------------------------------------|
| 1     | `log-parser`       | JSONL → filtered CSV                |
| 2     | `csv-stats-reporter`| filtered CSV → stats JSON report   |

## Inputs (Unified Interface)

| Parameter       | Flag          | Required | Source Skill       | Description                                           |
|-----------------|---------------|----------|--------------------|-------------------------------------------------------|
| input           | `-i`          | Yes      | log-parser         | Path to the input `.jsonl` log file                   |
| output          | `-o`          | Yes      | csv-stats-reporter | Path to the output JSON stats report                  |
| start-time      | `--start`     | No       | log-parser         | Start of time window (e.g. `09:00`)                   |
| end-time        | `--end`       | No       | log-parser         | End of time window (e.g. `17:00`)                     |
| levels          | `--levels`    | No       | log-parser         | Comma-separated severity filter (e.g. `ERROR,WARN`)   |
| columns         | `--columns`   | No       | csv-stats-reporter | Numeric columns to analyse (default: all)             |
| group-by        | `--group-by`  | No       | csv-stats-reporter | Column to group statistics by (e.g. `service`)        |
| keep-csv        | `--keep-csv`  | No       | pipeline           | Keep the intermediate filtered CSV file               |

## Processing Steps

1. **Stage 1 — Log Filtering**: Invoke `log-parser` on the input JSONL file with
   the specified time range and severity filters. Output goes to a temporary CSV.
2. **Stage 2 — Stats Computation**: Invoke `csv-stats-reporter` on the filtered
   CSV with the specified columns and group-by settings. Output goes to the final
   JSON report.
3. **Cleanup**: Remove the intermediate CSV unless `--keep-csv` is specified.

## Output

A JSON stats report (same format as `csv-stats-reporter` output) containing
per-column metrics for the filtered log events.

## Implementation

```bash
python3 ./skills/log-health-analyzer/log_health_analyzer.py \
    -i <input.jsonl> -o <stats_report.json> \
    [--start HH:MM] [--end HH:MM] [--levels ERROR,WARN] \
    [--columns response_time_ms] [--group-by service] [--keep-csv]
```

## Dependencies

- Python 3.10+ (standard library only)
- Sub-skills: `log-parser`, `csv-stats-reporter`
