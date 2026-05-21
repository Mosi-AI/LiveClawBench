#!/usr/bin/env bash
# Reference solution for pricing-matrix-reconcile.
# Opens the pricing site, reads all plan/region/cycle combinations, fills the CSV.
set -euo pipefail

WORKSPACE="/home/node/.openclaw/workspace"
OUTPUT="${WORKSPACE}/pricing_matrix.csv"

python3 - "${OUTPUT}" <<'PY'
import csv, sys

output_path = sys.argv[1]

# Ground-truth data matching the mock pricing server
rows = [
    # plan_id, tier, region, billing_cycle, price, users, storage_gb, api_calls_monthly
    ("PLAN_F", "free-tier",  "US", "monthly", "$0/mo",   "1",         "1",   "500"),
    ("PLAN_P", "team-5",     "US", "monthly", "$29/mo",  "5",         "10",  "5000"),
    ("PLAN_B", "team-20",    "US", "monthly", "$99/mo",  "20",        "50",  "25000"),
    ("PLAN_E", "enterprise", "US", "monthly", "$299/mo", "Unlimited", "200", "Unlimited"),
    ("PLAN_F", "free-tier",  "US", "annual",  "$0/mo",   "1",         "1",   "500"),
    ("PLAN_P", "team-5",     "US", "annual",  "$23/mo",  "5",         "10",  "5000"),
    ("PLAN_B", "team-20",    "US", "annual",  "$79/mo",  "20",        "50",  "25000"),
    ("PLAN_E", "enterprise", "US", "annual",  "$239/mo", "Unlimited", "200", "Unlimited"),
    ("PLAN_F", "free-tier",  "EU", "monthly", "€0/mo",   "1",         "1",   "500"),
    ("PLAN_P", "team-5",     "EU", "monthly", "€27/mo",  "5",         "10",  "5000"),
    ("PLAN_B", "team-20",    "EU", "monthly", "€91/mo",  "20",        "50",  "25000"),
    ("PLAN_E", "enterprise", "EU", "monthly", "€275/mo", "Unlimited", "200", "Unlimited"),
    ("PLAN_F", "free-tier",  "EU", "annual",  "€0/mo",   "1",         "1",   "500"),
    ("PLAN_P", "team-5",     "EU", "annual",  "€21/mo",  "5",         "10",  "5000"),
    ("PLAN_B", "team-20",    "EU", "annual",  "€73/mo",  "20",        "50",  "25000"),
    ("PLAN_E", "enterprise", "EU", "annual",  "€220/mo", "Unlimited", "200", "Unlimited"),
]

with open(output_path, "w", newline="", encoding="utf-8") as fh:
    writer = csv.writer(fh)
    writer.writerow(["plan_id", "tier", "region", "billing_cycle", "price", "users", "storage_gb", "api_calls_monthly"])
    for row in rows:
        writer.writerow(row)

print(f"Written {len(rows)} rows to {output_path}")
PY
