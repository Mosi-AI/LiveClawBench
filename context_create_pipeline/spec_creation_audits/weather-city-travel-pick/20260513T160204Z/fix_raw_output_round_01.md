===SPEC_START===
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
tags = ["travel_planning", "health_wellness"]
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

## 2. Task Goal

The agent must consult a local weather service covering five Chinese cities, evaluate each city against unstated but inferable comfort and air-quality thresholds, identify the city that best satisfies both constraints, and persist a structured recommendation to a file. The goal is framed as a travel-planning favour with no explicit filtering rules given; the agent must infer what "good air quality" and "comfortable temperatures" mean from the data and domain context.

## 3. Agent Instruction Draft

A friend is planning a weekend trip and wants to visit a city with good air quality and comfortable temperatures. Check the weather service at http://localhost:3000/ (open it in your browser) for all five available cities. Based on the air quality and temperature data, recommend the city that best meets both criteria. Save your recommendation to `/workspace/output/travel_pick.json` with the following keys:
- `"city"` — the city name in Chinese
- `"aqi"` — integer AQI value
- `"temp_high_c"` — integer high temperature in Celsius
- `"reason"` — one sentence explaining why this city was chosen

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

## 5. Expected Behavior / Reference Path

1. Agent discovers city list via `GET /api/locations` or by browsing `http://localhost:3000/`.
2. For each of the five cities, agent fetches AQI and temp_high_c.
3. Agent applies filter: `aqi < 100 AND temp_high_c >= 15 AND temp_high_c <= 28`
   - Qualifying: 北京 (AQI=75, temp=28), 上海 (AQI=35, temp=22)
   - Eliminated: 深圳 (temp=30 > 28), 成都 (AQI=120 ≥ 100), 哈尔滨 (temp=12 < 15)
4. Picks lowest AQI → 上海 (AQI=35)
5. Writes `/workspace/output/travel_pick.json`

*Hidden from instruction.md*: correct answer is 上海, AQI=35, temp_high_c=22.

## 6. Verifier Design

**Verifier type**: `tests/verify.py`

| Dim | Weight | State Read | Criterion | Partial Credit |
|---|---|---|---|---|
| 1 | 0.4 | `city` field | equals `上海` | none |
| 2 | 0.3 | `aqi` field | equals `35` (int) | none |
| 3 | 0.3 | `temp_high_c` field | within ±1 of `22` | none |

- File missing or invalid JSON → reward 0.0, exit 1
- Zero-work baseline: 0.0
- `/logs/verifier/reward.txt` ← scalar float
- `/logs/verifier/reward.json` ← `{"reward": X, "dim_city": Y, "dim_aqi": Z, "dim_temp": W, "_meta_city_got": "...", "_meta_aqi_got": N}`
- `Score: X.X/1.0` printed; exit non-zero if score < 0.5

## 7. Required Files

- `tasks/weather-city-travel-pick/task.toml`
- `tasks/weather-city-travel-pick/instruction.md`
- `tasks/weather-city-travel-pick/environment/Dockerfile`
- `tasks/weather-city-travel-pick/solution/solve.sh`
- `tasks/weather-city-travel-pick/tests/test.sh`
- `tasks/weather-city-travel-pick/tests/verify.py`

## 8. Implementation Notes And Pitfalls

- `[environment].allow_internet = true` required.
- Dockerfile inherits from `liveclawbench-weather-city-travel-pick-base:latest` (per-task base image built by setup.sh step 4 from `mock-platform/config/task-binary-map.json`).
- `mock-platform/config/task-binary-map.json` must contain an entry for `weather-city-travel-pick` mapping to the `weather` binary (e.g. `"weather-city-travel-pick": {"binaries": ["weather"]}`).
- `tests/test.sh` must not suppress verify.py exit code.
- `city` field must match Chinese `上海`, not ASCII `Shanghai`.
- `aqi` and `temp_high_c` must be integers.
- Weather mock is date-aware; all seed values are deterministic regardless of run date.
- B1=1: instruction intentionally omits exact numeric thresholds; agent must infer "good air quality" and "comfortable temperatures" from domain knowledge and AQI category labels exposed by the API.
- `reason` field is free-text; not verified.
===SPEC_END===

===FIX_LOG_START===
# Fix Log Round 1: weather-city-travel-pick

## Fixed Findings

| issue_id | change made | spec sections changed |
|---|---|---|
| F-01 | Removed explicit numeric thresholds (`AQI < 100`, `temp 15–28°C`) from §3 agent instruction; replaced with implicit language ("good air quality and comfortable temperatures", "best meets both criteria"). Updated §8 note to correctly state that instruction omits exact thresholds so agent must infer them from domain knowledge and API category labels. §5 reference path retains the explicit thresholds as the hidden solution guide. | §3, §8 |
| F-02 | Replaced tag `deep_research_report` with `travel_planning` in the Suggested task.toml tags array. | §1 (task.toml) |
| W-01 | Corrected Dockerfile base image name in §8 from `liveclawbench-weather-base:latest` to `liveclawbench-weather-city-travel-pick-base:latest`. Added explicit note that `mock-platform/config/task-binary-map.json` must contain a `weather-city-travel-pick` → `weather` binary entry. | §8 |

## Unresolved Findings

| issue_id | reason not fixed | user action needed |
|---|---|---|
| — | All findings resolved. | — |

===FIX_LOG_END===
