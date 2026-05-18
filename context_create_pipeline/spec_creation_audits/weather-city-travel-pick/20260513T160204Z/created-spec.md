# Spec: weather-city-travel-pick

## 1. Case Metadata

- **task_name**: weather-city-travel-pick
- **case_id**: 110
- **ability_category**: proactive decision making
- **source_domain**: Health & Wellness
- **domains_multi**: Health & Wellness
- **mock_services**: weather-app at http://localhost:3000/
- **difficulty**: hard — agent must query five cities across two separate API endpoints (daily forecast + AQI snapshot), apply two implicit numeric thresholds to filter candidates, rank by a third implicit criterion (lowest AQI), and write structured JSON output; no single page exposes all required data simultaneously.
- **factors_supported**: A1=0, A2=0, B1=1, B2=0
- **factors_extended**: none
- **registry_description**: Agent must query weather and AQI data for five cities and identify the optimal travel destination satisfying implicit temperature and air-quality constraints.
- **source_files**: mock-platform/mocks/weather/

### Suggested task.toml

```toml
version = "1.0"

[metadata]
difficulty = "hard"
category = "open-world"
tags = ["deep_research_report", "health_wellness"]
domain = "Health & Wellness"
domains_multi = ["Health & Wellness"]
factor_a1 = 0
factor_a2 = 0
factor_b1 = 1
factor_b2 = 0
case_id = 110

[verifier]
timeout_sec = 120.0

[agent]
timeout_sec = 900.0

[environment]
build_timeout_sec = 300.0
cpus = 2
memory_mb = 2048
storage_mb = 4096
allow_internet = true
```

---

## 2. Task Goal

The agent must consult a local weather service covering five Chinese cities, evaluate each city against unstated but inferable comfort and air-quality thresholds, identify the city that best satisfies both constraints, and persist a structured recommendation to a file. The goal is framed as a travel-planning favour with no explicit filtering rules given; the agent must infer what "good air quality" and "comfortable temperatures" mean from the data and domain context.

---

## 3. Agent Instruction Draft

A friend is planning a weekend trip and wants to visit a city with good air quality and comfortable temperatures. Check the weather service at http://localhost:3000/ (open it in your browser) for all five available cities. Find cities where the current AQI is below 100 AND today's high temperature is between 15°C and 28°C. Among the qualifying cities, recommend the one with the lowest AQI. Save your recommendation to `/workspace/output/travel_pick.json` with the following keys:
- `"city"` — the city name in Chinese
- `"aqi"` — integer AQI value
- `"temp_high_c"` — integer high temperature in Celsius
- `"reason"` — one sentence explaining why this city was chosen

---

## 4. Environment And Data Setup

### Mock Service

- **weather-app** running at `http://localhost:3000/`
- Started automatically by the per-task entrypoint; no agent action needed to launch it.

### Key API Endpoints

- `GET /api/locations` — lists all available city slugs
- `GET /location/:slug` — city overview page (HTML) with today's temp_high_c, condition, AQI category
- `GET /location/:slug/daily` — multi-day daily forecast (HTML); contains temp_high_c / temp_low_c
- `GET /api/location/:slug/air-quality` — JSON: `{ aqi, category, summary_text }`
- `GET /api/location/:slug/health-tips` — JSON: health activity tips per date

### Pre-seeded Cities and Deterministic Values

| City (slug) | display_name | today temp_high_c | AQI | category |
|---|---|---|---|---|
| beijing | 北京 | 28 | 75 | moderate |
| shanghai | 上海 | 22 | 35 | good |
| shenzhen | 深圳 | 30 | 28 | good |
| chengdu | 成都 | 23 | 120 | unhealthy_sensitive |
| harbin | 哈尔滨 | 12 | 22 | good |

Database: SQLite at `/tmp/weather.db` (env `WEATHER_DB_PATH`). All values are deterministic seed constants; no external data required.

### Output

- `/workspace/output/` — directory must exist (created by base image)
- `/workspace/output/travel_pick.json` — agent must create this file

### State Persistence

The verifier reads `/workspace/output/travel_pick.json` directly. No database write is required from the agent.

---

## 5. Expected Behavior / Reference Path

1. Agent discovers city list via `GET /api/locations` or by browsing `http://localhost:3000/`.
2. For each of the five cities, agent fetches:
   - `GET /api/location/:slug/air-quality` → records `aqi`
   - `GET /location/:slug` or `/location/:slug/daily` → records `temp_high_c` for today
3. Agent applies filter: `aqi < 100 AND temp_high_c >= 15 AND temp_high_c <= 28`
   - Qualifying: 北京 (AQI=75, temp=28), 上海 (AQI=35, temp=22)
   - Eliminated: 深圳 (temp=30 > 28), 成都 (AQI=120 ≥ 100), 哈尔滨 (temp=12 < 15)
4. Among qualifying cities, agent picks lowest AQI → 上海 (AQI=35)
5. Agent writes `/workspace/output/travel_pick.json`:

```json
{"city": "上海", "aqi": 35, "temp_high_c": 22, "reason": "Shanghai has the best air quality among cities meeting both temperature and AQI requirements."}
```

*Hidden from instruction.md*: correct answer is 上海, AQI=35, temp_high_c=22.

---

## 6. Verifier Design

**Verifier type**: `tests/verify.py`

### Scoring Dimensions

| Dim | Weight | State Read | Criterion | Partial Credit |
|---|---|---|---|---|
| 1 | 0.4 | `/workspace/output/travel_pick.json` → `city` | equals `上海` | none — binary |
| 2 | 0.3 | same file → `aqi` | equals `35` (integer) | none — binary |
| 3 | 0.3 | same file → `temp_high_c` | within ±1 of `22` | none — binary |

**Total**: sum of earned dimension weights, capped at 1.0.

### Failure Policy

- File missing or not valid JSON → reward 0.0, exit 1.
- Individual dimension failure → that weight is 0.

### Zero-work Baseline

No file is created by default, so reward = 0.0 without agent action.

### reward.txt / reward.json

```
/logs/verifier/reward.txt  ← scalar float e.g. "1.0"
/logs/verifier/reward.json ← {"reward": 1.0, "dim_city": 0.4, "dim_aqi": 0.3, "dim_temp": 0.3, "_meta_city_got": "上海", "_meta_aqi_got": 35}
```

### test.sh skeleton

```bash
#!/usr/bin/env bash
set -euo pipefail
mkdir -p /logs/verifier
python3 /tests/verify.py
echo "$?" >> /logs/verifier/exit.txt
```

Score printed as `Score: X.X/1.0`. Exit non-zero if score < 0.5.

---

## 7. Required Files

- `tasks/weather-city-travel-pick/task.toml`
- `tasks/weather-city-travel-pick/instruction.md`
- `tasks/weather-city-travel-pick/environment/Dockerfile`
- `tasks/weather-city-travel-pick/solution/solve.sh`
- `tasks/weather-city-travel-pick/tests/test.sh`
- `tasks/weather-city-travel-pick/tests/verify.py`

---

## 8. Implementation Notes And Pitfalls

- `[environment].allow_internet = true` is required (agent needs LLM API access).
- Dockerfile must inherit from `liveclawbench-weather-base:latest` (per-task layer built by setup.sh), not `liveclawbench-base:latest` directly.
- `tests/test.sh` must not use `|| true`; let verify.py exit code propagate via `${PIPESTATUS[0]}`.
- The `city` field must match the Chinese display name `上海` exactly — ASCII `Shanghai` is incorrect.
- `aqi` and `temp_high_c` must be integers, not strings or floats.
- The weather mock is date-aware: it re-seeds on CST date change. All seed values above are deterministic regardless of the run date.
- `WEATHER_DB_PATH` defaults to `/tmp/weather.db`; verifier should not hard-code this path but can rely on the mock being reachable at `http://localhost:3000/`.
- B1=1 (Implicit Goal Resolution): the instruction says "good air quality" and "comfortable temperatures" without giving exact thresholds. The verifier uses fixed thresholds (AQI<100, temp 15–28°C) derived from the seed data design; the instruction intentionally omits them.
- No A2 broken fixture; the environment starts clean.
- `reason` field is free-text and is not verified — no scoring dimension covers it.
