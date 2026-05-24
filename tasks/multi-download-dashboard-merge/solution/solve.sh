#!/bin/bash
set -e

echo "Fetching CSV exports from dashboard..."
curl -s 'http://localhost:8400/api/export/traffic?start=2026-04-01&end=2026-04-05' > /tmp/traffic.csv
curl -s 'http://localhost:8400/api/export/conversions?start=2026-04-01&end=2026-04-05' > /tmp/conversions.csv
curl -s 'http://localhost:8400/api/export/spend?start=2026-04-01&end=2026-04-05' > /tmp/spend.csv

python3 << 'PYEOF'
import csv
import json
import os

# Load column map
with open("/workspace/column_map.json", "r") as f:
    col_map = json.load(f)

date_map = col_map["date_columns"]
metric_map = col_map["metric_columns"]

def normalize(path):
    rows = []
    with open(path, "r", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            nr = {}
            for k, v in row.items():
                k_clean = k.strip()
                if k_clean in date_map:
                    nr["date"] = v.strip()
                elif k_clean in metric_map:
                    nr[metric_map[k_clean]] = v.strip()
            rows.append(nr)
    return rows

traffic = normalize("/tmp/traffic.csv")
conversions = normalize("/tmp/conversions.csv")
spend = normalize("/tmp/spend.csv")

# Read existing daily_merge.csv
existing = []
existing_dates = set()
out_of_range = []
target_path = "/workspace/daily_merge.csv"
if os.path.exists(target_path):
    with open(target_path, "r", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            d = row.get("date", "").strip()
            if d < "2026-04-01" or d > "2026-04-05":
                out_of_range.append(row)
            existing_dates.add(d)

# Merge by date
canonical_cols = ["date", "traffic_visits", "traffic_uniques",
                  "conversion_leads", "conversion_signups",
                  "spend_amount", "spend_clicks"]

merged = {}
for r in traffic:
    merged[r["date"]] = {c: r.get(c, "") for c in canonical_cols}
for r in conversions:
    d = r["date"]
    if d in merged:
        for c in ["conversion_leads", "conversion_signups"]:
            merged[d][c] = r.get(c, "")
for r in spend:
    d = r["date"]
    if d in merged:
        for c in ["spend_amount", "spend_clicks"]:
            merged[d][c] = r.get(c, "")

# Write output
with open(target_path, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=canonical_cols)
    writer.writeheader()
    for r in out_of_range:
        writer.writerow(r)
    for d in sorted(merged.keys()):
        writer.writerow(merged[d])

print(f"Oracle solution: {len(out_of_range) + len(merged)} rows written to {target_path}")
PYEOF
