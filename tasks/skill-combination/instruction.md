I have API server logs from 4 days this week that all need the same analysis. For each day, please:

1. Filter the JSONL log file to extract only ERROR and WARN events between 09:00 and 17:00, and save the filtered result as a CSV.
2. Compute response time statistics (mean, median, p95, p99) on the filtered data, grouped by service, and save the stats report as JSON.

You can use the existing skills in `/workspace/environment/skills/` to help.

Here are the files:

- Monday: `/workspace/environment/data/api_server_monday.jsonl` → CSV to `/workspace/environment/output/monday_filtered.csv`, stats to `/workspace/environment/output/monday_stats.json`
- Tuesday: `/workspace/environment/data/api_server_tuesday.jsonl` → CSV to `/workspace/environment/output/tuesday_filtered.csv`, stats to `/workspace/environment/output/tuesday_stats.json`
- Wednesday: `/workspace/environment/data/api_server_wednesday.jsonl` → CSV to `/workspace/environment/output/wednesday_filtered.csv`, stats to `/workspace/environment/output/wednesday_stats.json`
- Thursday: `/workspace/environment/data/api_server_thursday.jsonl` → CSV to `/workspace/environment/output/thursday_filtered.csv`, stats to `/workspace/environment/output/thursday_stats.json`

After processing all four days, I realize this is the same two-step process every time. We already have log-parser and csv-stats-reporter as separate skills. Could you create a combined skill that chains them together so I can do this in one step next time? Save the new skill (SKILL.md + implementation script) to `/workspace/model_response/`.
