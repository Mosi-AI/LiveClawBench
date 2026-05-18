You are an isolated spec auditor for LiveClawBench. Do not rewrite or fix the spec. Be strict, concrete, and evidence-based. Verify whether previous findings were actually fixed. Mark PASS only when every material issue is absent.

## CSV Row

```
case_id: 110 / task_name: weather-city-travel-pick / difficulty: H / ability_category: proactive decision making / domain: Health & Wellness / domains_multi: Health & Wellness / factors: A1=0; A2=0; B1=1; B2=0 / registry_description: Agent must query weather and AQI data for five cities and identify the optimal travel destination satisfying implicit temperature and air-quality constraints. / scoring_criteria_overview: Dim1 (0.4): city == 上海. Dim2 (0.3): aqi == 35. Dim3 (0.3): temp_high_c within ±1 of 22. Score >= 0.5 to pass.
```

## Mock Snapshot

```
mock-platform/mocks/weather/src/ — index.tsx, seed.ts, types.ts
Routes: /api/locations, /api/location/:slug/air-quality, /location/:slug, /location/:slug/daily
5 cities: beijing/北京, shanghai/上海, shenzhen/深圳, chengdu/成都, harbin/哈尔滨
Per-task base convention: liveclawbench-{task}-base:latest
task-binary-map.json sample: weather-aqi-report -> {binaries:["weather"]}
```

## Previous Audit (Round 1) Findings

- F-01 (FAIL): B1=1 conflicted with explicit thresholds in instruction → FIXED (thresholds removed from §3)
- F-02 (FAIL): tag `deep_research_report` misaligned → FIXED (changed to `travel_planning`)
- W-01 (WARN): wrong Dockerfile base image name → FIXED (corrected to `liveclawbench-weather-city-travel-pick-base:latest`, task-binary-map.json note added)

## Current Spec (after fix round 1)

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

The verifier reads `/workspace/output/travel_pick.json` directly.

## 5. Expected Behavior / Reference Path

1. Agent discovers city list via `GET /api/locations` or by browsing `http://localhost:3000/`.
2. For each city, fetches AQI and temp_high_c.
3. Applies filter: `aqi < 100 AND temp_high_c >= 15 AND temp_high_c <= 28`
   - Qualifying: 北京 (75, 28), 上海 (35, 22)
   - Eliminated: 深圳 (temp>28), 成都 (AQI≥100), 哈尔滨 (temp<15)
4. Picks lowest AQI → 上海 (35)
5. Writes `/workspace/output/travel_pick.json`

*Hidden from instruction.md*: correct answer is 上海, AQI=35, temp_high_c=22.

## 6. Verifier Design

**Verifier type**: `tests/verify.py`

| Dim | Weight | State Read | Criterion | Partial Credit |
|---|---|---|---|---|
| 1 | 0.4 | `city` | equals `上海` | none |
| 2 | 0.3 | `aqi` | equals `35` (int) | none |
| 3 | 0.3 | `temp_high_c` | within ±1 of `22` | none |

- Missing/invalid JSON → reward 0.0, exit 1
- Zero-work baseline: 0.0
- `/logs/verifier/reward.txt` ← scalar float
- `/logs/verifier/reward.json` ← `{"reward":X, "dim_city":Y, "dim_aqi":Z, "dim_temp":W, "_meta_city_got":"...", "_meta_aqi_got":N}`
- Prints `Score: X.X/1.0`; exit non-zero if score < 0.5

## 7. Required Files

- `tasks/weather-city-travel-pick/task.toml`
- `tasks/weather-city-travel-pick/instruction.md`
- `tasks/weather-city-travel-pick/environment/Dockerfile`
- `tasks/weather-city-travel-pick/solution/solve.sh`
- `tasks/weather-city-travel-pick/tests/test.sh`
- `tasks/weather-city-travel-pick/tests/verify.py`

## 8. Implementation Notes And Pitfalls

- `[environment].allow_internet = true` required.
- Dockerfile inherits from `liveclawbench-weather-city-travel-pick-base:latest`.
- `mock-platform/config/task-binary-map.json` must contain `"weather-city-travel-pick": {"binaries": ["weather"]}`.
- `tests/test.sh` must not suppress verify.py exit code.
- `city` field must be Chinese `上海`, not ASCII `Shanghai`.
- `aqi` and `temp_high_c` must be integers.
- Weather mock is date-aware; seed values are deterministic regardless of run date.
- B1=1: instruction omits exact numeric thresholds; agent infers from domain knowledge and AQI category labels.
- `reason` field is free-text; not verified.

---

## Checklist (key rules)

- 8 sections in order, all required fields present
- B1=1 consistent: instruction must NOT give explicit thresholds
- Tags snake_case, aligned with domain
- No scoring/verifier language in §2 or §3
- Dockerfile base: liveclawbench-{task}-base:latest
- reward.txt + reward.json with _meta_ prefix for non-numeric
- test.sh non-stub, creates /logs/verifier
- Zero-work baseline = 0.0
- allow_internet = true

---

## Required Output Format

```markdown
# Audit Round 2: weather-city-travel-pick

STATUS: PASS|FAIL

## Summary
<brief>

## Findings
| issue_id | severity | checklist_source | spec_section | evidence | required_fix | status |

## Previous Round Verification
<list each prior finding and whether it was fixed>

## Metadata Check
<assessment>

## Instruction Leakage Check
<assessment>

## Environment And Verifier Check
<assessment>

## Unresolved Issue Summary
<None if PASS>
```
