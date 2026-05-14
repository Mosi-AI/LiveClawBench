#!/usr/bin/env python3
"""Verify weather-aqi-report: agent correctly reads Beijing AQI from weather service."""

import json
import os
import sys
import urllib.request

REPORT_PATH = "/workspace/output/aqi_report.json"


def get_ground_truth():
    """Fetch ground truth AQI from the live weather service."""
    try:
        with urllib.request.urlopen(
            "http://localhost:3000/api/location/beijing/air-quality", timeout=5
        ) as r:
            data = json.load(r)["data"]
            return data["aqi"], data["category"]
    except Exception:
        # Fallback to seeded values if service is unreachable
        return 75, "moderate"


score = 0.0
details = []

try:
    with open(REPORT_PATH) as f:
        report = json.load(f)

    true_aqi, true_category = get_ground_truth()

    city_ok = report.get("city") == "北京"
    aqi_ok = report.get("aqi") == true_aqi
    category_ok = report.get("category") == true_category

    details.append(f"city: {'OK' if city_ok else 'FAIL'} (got {report.get('city')!r})")
    details.append(
        f"aqi: {'OK' if aqi_ok else 'FAIL'} (expected {true_aqi}, got {report.get('aqi')})"
    )
    details.append(
        f"category: {'OK' if category_ok else 'FAIL'} (expected {true_category!r}, got {report.get('category')!r})"
    )

    if city_ok and aqi_ok and category_ok:
        score = 1.0
    elif city_ok and (aqi_ok or category_ok):
        score = 0.5

except FileNotFoundError:
    details.append(f"Output file not found: {REPORT_PATH}")
except (json.JSONDecodeError, KeyError) as e:
    details.append(f"Invalid output format: {e}")

for d in details:
    print(d)
print(f"Score: {score}/1.0")

os.makedirs("/logs/verifier", exist_ok=True)
with open("/logs/verifier/reward.txt", "w") as f:
    f.write(str(score))

sys.exit(0 if score >= 0.5 else 1)
