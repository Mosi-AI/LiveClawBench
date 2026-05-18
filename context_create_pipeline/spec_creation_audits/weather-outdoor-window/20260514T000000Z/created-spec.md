# Spec: weather-outdoor-window

## 1. Case Metadata

- **task_name**: weather-outdoor-window
- **case_id**: 111
- **ability_category**: proactive decision making
- **source_domain**: Health & Wellness
- **domains_multi**: Health & Wellness
- **mock_services**: weather-app at http://localhost:3000/
- **difficulty**: hard — agent must parse 24 hourly rows from an HTML forecast page, infer two implicit constraints (no precipitation AND comfortable temperature) that determine which hours qualify, apply a sliding-window algorithm to find the longest continuous qualifying block, and persist the result as structured JSON; no single value or summary exposes the answer directly.
- **factors_supported**: A1=0, A2=0, B1=1, B2=0
- **factors_extended**: none
- **registry_description**: Agent must process hourly forecast data for a city and identify the longest continuous time window satisfying implicit temperature and precipitation constraints suitable for outdoor exercise.
- **source_files**: mock-platform/mocks/weather/

### Suggested task.toml

```toml
version = "1.0"

[metadata]
difficulty = "hard"
category = "open-world"
tags = ["outdoor_exercise", "health_wellness"]
domain = "Health & Wellness"
domains_multi = ["Health & Wellness"]
factor_a1 = 0
factor_a2 = 0
factor_b1 = 1
factor_b2 = 0
case_id = 111

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

The agent must consult today's hourly weather forecast for Shanghai, infer what conditions make an outdoor run suitable (no precipitation, comfortable temperature), identify the longest continuous block of qualifying hours, and persist the time window as structured JSON. The filtering criteria are not stated; the agent must reason from domain knowledge and the data columns visible on the forecast page.

## 3. Agent Instruction Draft

You want to go for an outdoor run in Shanghai today. Check today's hourly forecast at http://localhost:3000/location/shanghai/hourly (open it in your browser) and identify the longest continuous block of time that's suitable for running outdoors. If there are multiple windows of the same length, choose the earliest one. Save your result to `/workspace/output/exercise_window.json` with the following keys:
- `"start_hour"` — integer hour (0–23) when the window starts
- `"end_hour"` — integer hour (0–23, inclusive) when the window ends
- `"duration_hours"` — integer count of hours in the window (end_hour − start_hour + 1)

## 4. Environment And Data Setup

### Mock Service

- **weather-app** running at `http://localhost:3000/`
- Started automatically by the per-task entrypoint; no agent action needed to launch it.

### Key API Endpoints

- `GET /location/shanghai/hourly` — HTML page listing 24 hourly rows for today plus first 6 tomorrow rows; columns include 时间 (hour), 温度 (temp_c °C), 天气 (condition text), 降水(mm) (precip_mm), 湿度 (humidity %), 云量 (cloud cover %).
- `GET /api/locations` — JSON list of all city slugs
- `GET /location/:slug` — city overview page (HTML)

### Pre-seeded Shanghai Hourly Pattern

Shanghai today: temp_high_c=22, temp_low_c=18, daily_precip=4mm.

| hour range | temp_c (approx) | precip_mm | qualifies |
|---|---|---|---|
| 00–09 | 18–21°C | 0.0 | yes |
| 10–20 | 21–22°C | ~0.4 | no (rain) |
| 21–23 | 20–19°C | 0.0 | yes |

Hourly temperature formula: `Math.round(20 + 2 × cos((hour − 14) / 24 × 2π))` → range 18–22°C (all within any reasonable running-temperature range).
Precipitation: `daily_precip / 11 ≈ 0.36 mm` for hours 10–20 inclusive; 0.0 for all other hours.

### Output

- `/workspace/output/` — directory must exist (created by base image)
- `/workspace/output/exercise_window.json` — agent must create this file

### State Persistence

The verifier reads `/workspace/output/exercise_window.json` directly. No database write is required from the agent.

## 5. Expected Behavior / Reference Path

1. Agent opens `http://localhost:3000/location/shanghai/hourly`.
2. Reads 24 rows for today; identifies columns: 时间, 温度, 降水(mm).
3. Filters qualifying hours: temp_c ∈ [10, 28] (all 24 qualify) AND precip_mm == 0 (hours 0–9 and 21–23).
4. Finds longest continuous qualifying block:
   - Block A: hours 0–9 → 10 hours
   - Block B: hours 21–23 → 3 hours
   - Winner: Block A (longest; also earliest if tied)
5. Writes `/workspace/output/exercise_window.json`

*Hidden from instruction.md*: correct answer is start_hour=0, end_hour=9, duration_hours=10.

## 6. Verifier Design

**Verifier type**: `tests/verify.py`

| Dim | Weight | State Read | Criterion | Partial Credit |
|---|---|---|---|---|
| 1 | 0.4 | `start_hour` | equals `0` (int) | none |
| 2 | 0.4 | `end_hour` | equals `9` (int) | none |
| 3 | 0.2 | `duration_hours` | equals `10` (int) | none |

- File missing or invalid JSON → reward 0.0, exit 1
- Zero-work baseline: 0.0
- `/logs/verifier/reward.txt` ← scalar float
- `/logs/verifier/reward.json` ← `{"reward": X, "dim_start": Y, "dim_end": Z, "dim_duration": W, "start_got": N, "end_got": M, "duration_got": P}`
- `Score: X.X/1.0` printed; exit non-zero if score < 0.5

## 7. Required Files

- `tasks/weather-outdoor-window/task.toml`
- `tasks/weather-outdoor-window/instruction.md`
- `tasks/weather-outdoor-window/environment/Dockerfile`
- `tasks/weather-outdoor-window/solution/solve.sh`
- `tasks/weather-outdoor-window/tests/test.sh`
- `tasks/weather-outdoor-window/tests/verify.py`

## 8. Implementation Notes And Pitfalls

- `[environment].allow_internet = true` required.
- Dockerfile inherits from `liveclawbench-weather-outdoor-window-base:latest` (per-task base image built by setup.sh step 4 from `mock-platform/config/task-binary-map.json`).
- `mock-platform/config/task-binary-map.json` must contain an entry for `weather-outdoor-window` mapping to the `weather` binary (e.g. `"weather-outdoor-window": {"binaries": ["weather"]}`).
- `tests/test.sh` must not suppress verify.py exit code.
- `start_hour`, `end_hour`, and `duration_hours` must be integers.
- The hourly page shows today's 24 rows followed by tomorrow's first 6 rows — verifier checks today's window only; agent should use today's data.
- Shanghai hourly temps all fall in 18–22°C range; temperature is never the binding constraint — the precipitation column is the key differentiator.
- Precipitation values in the HTML: "0.0" for hours 0–9 and 21–23; "0.4" for hours 10–20.
- B1=1: instruction intentionally omits exact temperature bounds and precipitation threshold; agent infers "suitable for running" from domain knowledge and visible forecast columns.
- `duration_hours` must equal `end_hour − start_hour + 1`; verifier checks all three fields independently.
- `reward.json` diagnostic fields `start_got`, `end_got`, `duration_got` are all integers; no `_meta_` prefix needed.
