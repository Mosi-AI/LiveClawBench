#!/usr/bin/env python3
import json
import os
import re
import sys
import urllib.request

OUTPUT_PATH = "/workspace/output/exercise_window.json"
LOG_DIR = "/logs/verifier"
os.makedirs(LOG_DIR, exist_ok=True)

# Suitability rule: an hour is suitable when its precipitation reading is "0.0".
# Derive the expected window from the live weather service so the verifier
# reflects the seeded data rather than repeating magic numbers.
_FALLBACK_START = 0
_FALLBACK_END = 9
_FALLBACK_DURATION = 10


def _compute_expected():
    try:
        with urllib.request.urlopen(
            "http://localhost:3000/location/shanghai/hourly", timeout=5
        ) as r:
            html = r.read().decode("utf-8", errors="replace")
        today_match = re.search(r"<h2>今天</h2>(.*?)(?=<h2>|$)", html, re.DOTALL)
        if not today_match:
            raise ValueError("today section missing")
        today_section = today_match.group(1)
        rows = re.findall(
            r"<tr><td>(\d{2}):00</td>"
            r"<td>[^<]+</td><td>[^<]+</td><td>[^<]+</td>"
            r"<td>([^<]+)</td>",
            today_section,
        )
        best_start, best_len = _FALLBACK_START, 0
        cur_start, cur_len = None, 0
        for hour_str, precip in rows:
            hour = int(hour_str)
            if precip.strip() == "0.0":
                if cur_len == 0:
                    cur_start = hour
                cur_len += 1
                if cur_len > best_len:
                    best_start, best_len = cur_start, cur_len
            else:
                cur_len = 0
        if best_len == 0:
            raise ValueError("no dry hours found")
        return best_start, best_start + best_len - 1, best_len
    except Exception:
        return _FALLBACK_START, _FALLBACK_END, _FALLBACK_DURATION


EXPECTED_START, EXPECTED_END, EXPECTED_DURATION = _compute_expected()


def write_reward(
    reward, dim_start, dim_end, dim_duration, start_got, end_got, duration_got
):
    with open(f"{LOG_DIR}/reward.txt", "w") as f:
        f.write(str(reward))
    with open(f"{LOG_DIR}/reward.json", "w") as f:
        json.dump(
            {
                "reward": reward,
                "dim_start": dim_start,
                "dim_end": dim_end,
                "dim_duration": dim_duration,
                "start_got": start_got,
                "end_got": end_got,
                "duration_got": duration_got,
            },
            f,
        )


try:
    with open(OUTPUT_PATH) as f:
        data = json.load(f)
except Exception:
    write_reward(0.0, 0, 0, 0, -1, -1, -1)
    print("Score: 0.0/1.0")
    sys.exit(1)

start_hour = data.get("start_hour", None)
end_hour = data.get("end_hour", None)
duration_hours = data.get("duration_hours", None)

dim_start = 0.4 if type(start_hour) is int and start_hour == EXPECTED_START else 0.0
dim_end = 0.4 if type(end_hour) is int and end_hour == EXPECTED_END else 0.0
dim_duration = (
    0.2 if type(duration_hours) is int and duration_hours == EXPECTED_DURATION else 0.0
)

reward = dim_start + dim_end + dim_duration
write_reward(
    reward,
    dim_start,
    dim_end,
    dim_duration,
    start_hour if type(start_hour) is int else -1,
    end_hour if type(end_hour) is int else -1,
    duration_hours if type(duration_hours) is int else -1,
)
print(f"Score: {reward}/1.0")
sys.exit(0 if reward >= 1.0 else 1)
