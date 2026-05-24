Open the analytics dashboard at http://localhost:8400/ in a browser. Set the export date
range to 2026-04-01 through 2026-04-05 inclusive. From the Traffic, Conversions, and Spend
tabs, download a CSV export for each tab covering the same date range. The column headers
vary across tabs — use /workspace/column_map.json to normalize all columns to their canonical
names and unify the date column. Merge the three normalized exports into
/workspace/daily_merge.csv, keyed by the canonical date column. Before writing, remove any
existing rows in daily_merge.csv whose date falls within 2026-04-01 to 2026-04-05, then
insert the newly merged rows for that range. Do not remove rows with dates outside this
range. Save the updated file.
