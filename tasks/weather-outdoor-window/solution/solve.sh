#!/usr/bin/env bash
set -e
mkdir -p /workspace/output

python3 - <<'PYEOF'
import re
import json
import urllib.request

BASE = "http://localhost:3000"

with urllib.request.urlopen(f"{BASE}/location/shanghai/hourly") as r:
    html = r.read().decode("utf-8", errors="replace")

# Extract only the "今天" section: content between <h2>今天</h2> and the next <h2> tag.
today_match = re.search(r"<h2>今天</h2>(.*?)(?=<h2>|$)", html, re.DOTALL)
if not today_match:
    raise RuntimeError("Could not find today's hourly section in page")
today_section = today_match.group(1)

# Parse hourly rows from today's section only.
# Each row: <tr><td>HH:00</td><td>temp</td><td>feels</td><td>cond</td><td>precip</td>...
today_rows = re.findall(
    r"<tr><td>(\d{2}):00</td><td>[^<]+</td><td>[^<]+</td><td>[^<]+</td><td>([^<]+)</td>",
    today_section,
)
if len(today_rows) != 24:
    raise RuntimeError(f"Expected 24 today rows, got {len(today_rows)}")

# Find longest consecutive block where precipitation is "0.0".
# Treat any non-"0.0" precip value as rain (covers "0.4", "0.5", etc.).
best_start, best_len = 0, 0
cur_start, cur_len = None, 0
for hour_str, precip in today_rows:
    hour = int(hour_str)
    if precip.strip() == "0.0":
        if cur_len == 0:
            cur_start = hour
        cur_len += 1
        if cur_len > best_len:
            best_start = cur_start
            best_len = cur_len
    else:
        cur_len = 0

if best_len == 0:
    raise RuntimeError("No dry hours found in today's forecast")

result = {
    "start_hour": best_start,
    "end_hour": best_start + best_len - 1,
    "duration_hours": best_len,
}

with open("/workspace/output/exercise_window.json", "w") as f:
    json.dump(result, f)
print("Written:", result)
PYEOF
