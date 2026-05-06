#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:5003"

for _ in $(seq 1 30); do
  if curl -sf "${BASE_URL}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -sf -X POST "${BASE_URL}/log/2026-05-06/entries" \
  -d "slot=snacks" \
  -d "food_name=banana" \
  -d "quantity_value=120" \
  -d "quantity_unit=g" \
  -d "calories_kcal=107" \
  -d "protein_g=1.3" \
  -d "carbs_g=27.1" \
  -d "fat_g=0.4" \
  -o /dev/null
