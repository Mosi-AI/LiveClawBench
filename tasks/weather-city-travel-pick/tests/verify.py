#!/usr/bin/env python3
import json
import os
import re
import sys
import urllib.request

OUTPUT_PATH = "/workspace/output/travel_pick.json"
LOG_DIR = "/logs/verifier"
os.makedirs(LOG_DIR, exist_ok=True)

# Selection rule: temp 15-26 °C, AQI <= 50, lowest AQI wins.
# The "city" field is the URL slug (ASCII, encoding-safe) rather than the
# Chinese display_name, which may render as mojibake in some environments.
_TEMP_MIN, _TEMP_MAX, _AQI_MAX = 15, 26, 50

# Seeded weather data (mirrors mock-platform/mocks/weather/src/seed.ts).
# Used as the fallback when the live service is unreachable.
_SEED = {
    "shanghai": {"aqi": 35, "temp_high_c": 22},
    "shenzhen": {"aqi": 28, "temp_high_c": 30},
    "harbin": {"aqi": 22, "temp_high_c": 12},
    "beijing": {"aqi": 75, "temp_high_c": 28},
    "chengdu": {"aqi": 120, "temp_high_c": 23},
}
_BEST_SLUG = min(
    (
        s
        for s, v in _SEED.items()
        if _TEMP_MIN <= v["temp_high_c"] <= _TEMP_MAX and v["aqi"] <= _AQI_MAX
    ),
    key=lambda s: _SEED[s]["aqi"],
)
_BEST_AQI = _SEED[_BEST_SLUG]["aqi"]
_BEST_TEMP = _SEED[_BEST_SLUG]["temp_high_c"]


def get_ground_truth():
    """Query the live weather service to derive the best city slug.

    Falls back to _SEED-derived values if the service is unreachable.
    """
    try:
        base = "http://localhost:3000"
        with urllib.request.urlopen(f"{base}/api/locations", timeout=5) as r:
            locations = json.load(r)["data"]

        best_slug, best_aqi, best_temp = None, 9999, 0
        for loc in locations:
            slug = loc["slug"]
            if slug not in _SEED:
                continue

            with urllib.request.urlopen(
                f"{base}/api/location/{slug}/air-quality", timeout=5
            ) as r:
                aqi = int(json.load(r)["data"]["aqi"])

            with urllib.request.urlopen(f"{base}/location/{slug}", timeout=5) as r:
                html = r.read().decode("utf-8", errors="replace")

            # Match only ASCII digits to avoid encoding-sensitive characters.
            m = re.search(r"font-size:48px[^>]*>(\d+)", html)
            temp = int(m.group(1)) if m else 0

            if _TEMP_MIN <= temp <= _TEMP_MAX and aqi <= _AQI_MAX and aqi < best_aqi:
                best_aqi, best_temp, best_slug = aqi, temp, slug

        if best_slug:
            return best_slug, best_aqi, best_temp
    except Exception:
        pass

    return _BEST_SLUG, _BEST_AQI, _BEST_TEMP


def write_reward(reward, dim_city, dim_aqi, dim_temp, city_got, aqi_got):
    with open(f"{LOG_DIR}/reward.txt", "w") as f:
        f.write(str(reward))
    with open(f"{LOG_DIR}/reward.json", "w") as f:
        json.dump(
            {
                "reward": reward,
                "dim_city": dim_city,
                "dim_aqi": dim_aqi,
                "dim_temp": dim_temp,
                "_meta_city_got": str(city_got),
                "_meta_aqi_got": int(aqi_got)
                if isinstance(aqi_got, (int, float))
                else -1,
            },
            f,
        )


try:
    with open(OUTPUT_PATH) as f:
        data = json.load(f)
except Exception:
    write_reward(0.0, 0, 0, 0, "", -1)
    print("Score: 0.0/1.0")
    sys.exit(1)

city = data.get("city", "")
aqi = data.get("aqi", None)
temp = data.get("temp_high_c", None)
reason = data.get("reason", "")

expected_slug, expected_aqi, expected_temp = get_ground_truth()

dim_city = 0.4 if city == expected_slug else 0.0
dim_aqi = 0.3 if isinstance(aqi, int) and aqi == expected_aqi else 0.0
# ±1°C tolerance: temperature readings may differ by 1 between service and agent
dim_temp = 0.3 if isinstance(temp, int) and abs(temp - expected_temp) <= 1 else 0.0

reward = dim_city + dim_aqi + dim_temp
aqi_for_log = aqi if isinstance(aqi, (int, float)) else -1
write_reward(reward, dim_city, dim_aqi, dim_temp, city, aqi_for_log)
print(f"Score: {reward}/1.0")
# A passing run requires all three fields correct (reward==1.0) and a non-empty reason.
if reward < 1.0 or not isinstance(reason, str) or not reason.strip():
    sys.exit(1)
sys.exit(0)
