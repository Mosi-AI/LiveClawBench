---
name: log-parser
description: Parse structured JSON-lines log files, filter by time range and severity, output as CSV.
version: 1.0.0
---

# Log Parser

## Skill Summary

Parses structured log files in JSON-lines (`.jsonl`) format. Each line is a JSON
object with at least `timestamp`, `level`, and `message` fields. The skill filters
events by time range and/or severity level and writes the matching rows as a CSV
file, making downstream tabular analysis easy.

## Inputs

| Parameter       | Flag   | Required | Description                                         |
|-----------------|--------|----------|-----------------------------------------------------|
| input           | `-i`   | Yes      | Path to the `.jsonl` log file                       |
| output          | `-o`   | Yes      | Path to the output CSV file                         |
| start-time      | `--start` | No    | Start of time window (ISO-8601, e.g. `09:00`)       |
| end-time        | `--end`   | No    | End of time window (ISO-8601, e.g. `17:00`)         |
| levels          | `--levels`| No    | Comma-separated severity filter (e.g. `ERROR,WARN`) |

## Processing Steps

1. Read the input file line by line; parse each line as JSON.
2. Normalise `timestamp` to `datetime`; skip malformed lines.
3. Apply time-range filter (if `--start` / `--end` provided).
4. Apply severity filter (if `--levels` provided; case-insensitive).
5. Write surviving records as CSV with columns:
   `timestamp, level, service, endpoint, response_time_ms, status_code, message`

## Output

A CSV file containing the filtered log events. Columns are derived from the JSON
keys present in the log entries.

## Implementation

```bash
python3 ./skills/log-parser/log_parser.py -i <input.jsonl> -o <output.csv> \
    [--start HH:MM] [--end HH:MM] [--levels LEVEL1,LEVEL2]
```

## Dependencies

- Python 3.10+ (standard library only)
