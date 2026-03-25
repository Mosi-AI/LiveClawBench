#!/usr/bin/env bash
set -euo pipefail

cd /workspace

# Single-round: agent should proactively create a skill after detecting
# the repeated CSV cleaning pattern (driven by SOUL.md self-evolve directive)
openclaw agent -m "Please clean up all CSV files in /workspace/environment/data/. For each file: remove all empty rows, standardize the date column to YYYY-MM-DD format, remove duplicate rows (by order_id), sort by amount in descending order. Save each cleaned file to /workspace/environment/cleaned/<original_name>_cleaned.csv. Files: sales_jan.csv, sales_feb.csv, sales_mar.csv, sales_apr.csv, sales_may.csv, sales_jun.csv, sales_jul.csv, sales_aug.csv. I have to do this same cleanup every month when new sales data comes in. It would be really nice if there were a quicker way to do this going forward."
