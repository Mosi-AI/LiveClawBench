#!/usr/bin/env bash
set -e
mkdir -p /workspace/output

python3 - <<'PYEOF'
import json
import re
import urllib.request

BASE = "http://localhost:3000"

# Known slugs for the five seeded cities.
# The task asks for the city slug (URL identifier), not the display name.
KNOWN_SLUGS = {"shanghai", "beijing", "shenzhen", "chengdu", "harbin"}


def fetch_json(url):
    with urllib.request.urlopen(url) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_html(url):
    with urllib.request.urlopen(url) as r:
        return r.read().decode("utf-8", errors="replace")


resp = fetch_json(f"{BASE}/api/locations")
cities = resp["data"]

best = None

for city in cities:
    slug = city["slug"]
    if slug not in KNOWN_SLUGS:
        continue

    aq = fetch_json(f"{BASE}/api/location/{slug}/air-quality")
    aqi = int(aq["data"]["aqi"])

    html = fetch_html(f"{BASE}/location/{slug}")
    # High temp appears in <div style="font-size:48px;font-weight:200">22°C</div>.
    # Match only the ASCII digits to avoid encoding-sensitive °C / Chinese text.
    m = re.search(r"font-size:48px[^>]*>(\d+)", html)
    temp = int(m.group(1)) if m else 0

    if 15 <= temp <= 26 and aqi <= 50 and (best is None or aqi < best["aqi"]):
        best = {"city": slug, "aqi": aqi, "temp_high_c": temp}

if best is None:
    raise RuntimeError("No qualifying city found")

best["reason"] = (
    f"{best['city']} has the lowest AQI ({best['aqi']}) among qualifying cities "
    f"and a comfortable high of {best['temp_high_c']}°C."
)

with open("/workspace/output/travel_pick.json", "w", encoding="utf-8") as f:
    json.dump(best, f, ensure_ascii=False)
print("Written:", best)
PYEOF
