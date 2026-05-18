# Plan: weather-outdoor-window

## 1. Plan Metadata

- **task_name**: weather-outdoor-window
- **source_spec**: context_create_pipeline/spec_creation_audits/weather-outdoor-window.md
- **target_task_dir**: tasks/weather-outdoor-window/
- **case_id**: 111
- **difficulty**: hard
- **domain**: Health & Wellness
- **domains_multi**: Health & Wellness
- **factors_supported**: A1=0, A2=0, B1=1, B2=0
- **mock_app_sources**: mock-platform/mocks/weather/ (Bun+Hono, binary: `weather`, port 3000)
- **expected_outputs**: /workspace/output/exercise_window.json
- **spec_snapshot_status**: complete

---

## 2. Context Creation Goal

### Spec Preservation Snapshot

**Task Goal** (preserved from spec §2):
The agent must consult today's hourly weather forecast for Shanghai, infer appropriate outdoor-exercise conditions from domain knowledge and the visible forecast columns, identify the longest continuous block of qualifying hours, and persist the time window as structured JSON. The filtering criteria are not stated; the agent must reason from the data columns visible on the forecast page.

**Agent Instruction Draft** (preserved from spec §3 — used verbatim in instruction.md):
> You want to go for an outdoor run in Shanghai today. Check today's hourly forecast at http://localhost:3000/location/shanghai/hourly (open it in your browser) and identify the longest continuous block of time that's suitable for running outdoors. If there are multiple windows of the same length, choose the earliest one. Save your result to `/workspace/output/exercise_window.json` with the following keys:
> - `"start_hour"` — integer hour (0–23) when the window starts
> - `"end_hour"` — integer hour (0–23, inclusive) when the window ends
> - `"duration_hours"` — integer count of hours in the window (end_hour − start_hour + 1)

*Hidden from instruction.md (implementer only)*: correct answer is start_hour=0, end_hour=9, duration_hours=10. Agent must infer no-precipitation and comfortable-temperature as qualifying criteria from domain knowledge, then apply a longest-continuous-run algorithm to hourly rows.

**Mock Services / Assets**:
- weather-app binary compiled from `mock-platform/mocks/weather/`
- Port: 3000
- Pre-task base image: `liveclawbench-weather-outdoor-window-base:latest`
- task-binary-map.json entry: `"weather-outdoor-window": {"binaries": ["weather"]}`

**Environment / Data Setup**:
- SQLite at `/tmp/weather.db` (env `WEATHER_DB_PATH`)
- Shanghai seeded with deterministic hourly data (24 rows for today + 6 tomorrow rows on page)
- Output dir: `/workspace/output/` (pre-created by base image)
- Output file: `/workspace/output/exercise_window.json` (agent writes)

**Pre-seeded Shanghai Hourly Pattern**:

| hour range | temp_c (approx) | precip_mm | qualifies |
|---|---|---|---|
| 00–09 | 18–21°C | 0.0 | yes |
| 10–20 | 21–22°C | ~0.4 | no (rain) |
| 21–23 | 20–19°C | 0.0 | yes |

Temp formula: `Math.round(20 + 2 × cos((hour − 14) / 24 × 2π))` → range 18–22°C.
Precip: `4mm / 11 ≈ 0.36 mm` rendered as "0.4" for hours 10–20; "0.0" elsewhere.

**Expected Behavior / Reference Path** (preserved from spec §5):
1. Agent opens `http://localhost:3000/location/shanghai/hourly`.
2. Reads 24 rows for today; identifies columns: 时间, 温度, 降水(mm).
3. Filters qualifying hours: precip_mm == 0 (hours 0–9 and 21–23 qualify; temperature is always in comfortable range for all 24 hours).
4. Finds longest continuous qualifying block:
   - Block A: hours 0–9 → 10 hours
   - Block B: hours 21–23 → 3 hours
   - Winner: Block A (longest; also earliest if tied)
5. Writes `/workspace/output/exercise_window.json`.

**Verifier Design** (preserved from spec §6):

| Dim | Weight | State Read | Criterion | Partial Credit |
|---|---|---|---|---|
| 1 | 0.4 | `start_hour` | equals `0` (int) | none |
| 2 | 0.4 | `end_hour` | equals `9` (int) | none |
| 3 | 0.2 | `duration_hours` | equals `10` (int) | none |

- Missing/invalid JSON → reward 0.0, exit 1
- Zero-work baseline: 0.0
- reward.txt: scalar float; reward.json: `{"reward": X, "dim_start": Y, "dim_end": Z, "dim_duration": W, "start_got": N, "end_got": M, "duration_got": P}` (all numeric — no `_meta_` prefix needed)
- Score: X.X/1.0; exit non-zero if score < 0.5

**Required Files** (from spec §7):
- tasks/weather-outdoor-window/task.toml
- tasks/weather-outdoor-window/instruction.md
- tasks/weather-outdoor-window/environment/Dockerfile
- tasks/weather-outdoor-window/solution/solve.sh
- tasks/weather-outdoor-window/tests/test.sh
- tasks/weather-outdoor-window/tests/verify.py

**Implementation Pitfalls** (from spec §8):
- `start_hour`, `end_hour`, `duration_hours` must be integers
- Hourly page shows 24 today + 6 tomorrow rows — agent should use only today's 24 rows
- Temperature is never the binding constraint (all hours 18–22°C qualify); precipitation column is the key differentiator
- Precip rendered as "0.4" (not "0.36") in HTML; agent should treat any non-zero value as rain
- B1=1: instruction omits exact thresholds; agent infers "suitable for running" from domain knowledge
- `duration_hours` must equal `end_hour − start_hour + 1`; verifier checks all three fields independently
- reward.json diagnostic fields (`start_got`, `end_got`, `duration_got`) are integers — no `_meta_` prefix
- Dockerfile base: `liveclawbench-weather-outdoor-window-base:latest`

---

## 3. Source Assets And Reuse Map

| Source | Target | Action | Notes |
|---|---|---|---|
| mock-platform/mocks/weather/ | (compiled binary in base image) | Reuse — binary already in `liveclawbench-weather-outdoor-window-base:latest` | No additional copy needed; setup.sh builds the per-task base image |
| mock-platform/config/task-binary-map.json | same file | Add entry `"weather-outdoor-window": {"binaries": ["weather"]}` | Required for setup.sh step 4 to build the per-task base image |
| docs/metadata/cases_registry.csv | same file | Append one new row for case_id=111 | Required by CLAUDE.md and cross-checked by `validate_annotations.py` |
| context_create_pipeline/spec_creation_audits/weather-outdoor-window.md | (this plan) | Reference only | Spec is the authority; do not copy into task directory |
| tasks/weather-outdoor-window/task.toml | new file | Create from spec §1 task.toml block | |
| tasks/weather-outdoor-window/instruction.md | new file | Create from spec §3 instruction draft | Exclude hidden oracle data and explicit thresholds |
| tasks/weather-outdoor-window/environment/Dockerfile | new file | Create; FROM liveclawbench-weather-outdoor-window-base:latest | Minimal — no additional app needed |
| tasks/weather-outdoor-window/solution/solve.sh | new file | Create oracle solution | Parses hourly HTML, applies qualifying logic, finds longest window, writes JSON |
| tasks/weather-outdoor-window/tests/test.sh | new file | Create; invokes verify.py, writes reward.txt | Must not suppress exit code |
| tasks/weather-outdoor-window/tests/verify.py | new file | Create; reads exercise_window.json, scores 3 dims | |

---

## 4. Step-By-Step Build Plan

### Step 1: Add task-binary-map.json entry

- Purpose: Enable setup.sh step 4 to build `liveclawbench-weather-outdoor-window-base:latest` with the weather binary.
- Files: `mock-platform/config/task-binary-map.json`
- Actions:
  - Add `"weather-outdoor-window": {"binaries": ["weather"]}` to the JSON object.
- Acceptance check:
  - `jq '."weather-outdoor-window"' mock-platform/config/task-binary-map.json` → `{"binaries": ["weather"]}`
- Depends on: none

### Step 2: Add cases_registry.csv row

- Purpose: Register case_id=111 in the task metadata index so that `validate_annotations.py` passes and the task is discoverable in the benchmark corpus.
- Files: `docs/metadata/cases_registry.csv`
- Actions:
  - Read the current file to confirm the header and current last row.
  - Append the following row (no trailing newline beyond the file's existing convention):
    ```
    111,proactive decision making,weather-outdoor-window,Agent must process hourly forecast data for a city and identify the longest continuous time window satisfying implicit temperature and precipitation constraints suitable for outdoor exercise.,H,Evaluates the agent's ability to parse hourly forecast HTML and apply domain-inferred constraints to find the optimal exercise window,Health & Wellness,Health & Wellness,0,0,1,0,planned
    ```
- Acceptance check:
  - `grep "^111," docs/metadata/cases_registry.csv` returns exactly one line matching the row above.
  - `python scripts/validate_annotations.py` passes (no duplicate or missing case_id errors).
- Depends on: none

### Step 3: Create task directory skeleton

- Purpose: Establish the standard task file tree.
- Files: `tasks/weather-outdoor-window/` (directory tree)
- Actions:
  - Create directories: `tasks/weather-outdoor-window/`, `environment/`, `solution/`, `tests/`
- Acceptance check:
  - All four directories exist.
- Depends on: none

### Step 4: Write task.toml

- Purpose: Encode difficulty, domain, factors, timeouts, and allow_internet.
- Files: `tasks/weather-outdoor-window/task.toml`
- Actions:
  - Write from spec §1 task.toml block verbatim; verify `allow_internet = true`.
- Content:
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
- Acceptance check:
  - `python scripts/validate_tasks.py` passes for this task.
  - `python scripts/validate_annotations.py` passes.
- Depends on: Step 3

### Step 5: Write instruction.md

- Purpose: Produce the agent-facing prompt without leaking oracle data or explicit thresholds.
- Files: `tasks/weather-outdoor-window/instruction.md`
- Actions:
  - Copy spec §3 instruction draft verbatim (B1=1 compliant — no explicit thresholds).
- Content:
  ```
  You want to go for an outdoor run in Shanghai today. Check today's hourly forecast at http://localhost:3000/location/shanghai/hourly (open it in your browser) and identify the longest continuous block of time that's suitable for running outdoors. If there are multiple windows of the same length, choose the earliest one. Save your result to /workspace/output/exercise_window.json with the following keys:
  - "start_hour" — integer hour (0–23) when the window starts
  - "end_hour" — integer hour (0–23, inclusive) when the window ends
  - "duration_hours" — integer count of hours in the window (end_hour − start_hour + 1)
  ```
- Acceptance check:
  - No explicit temperature bounds (10, 28) appear in the file.
  - No explicit precipitation threshold appears in the file.
  - No oracle answer (0, 9, 10) appears in the file.
  - URL uses `http://localhost:3000/location/shanghai/hourly` with "open it in your browser".
- Depends on: Step 3

### Step 6: Write environment/Dockerfile

- Purpose: Define the task container environment. The mock service is already embedded in the per-task base image; no additional app to install.
- Files: `tasks/weather-outdoor-window/environment/Dockerfile`
- Actions:
  - Write minimal Dockerfile inheriting from the per-task base image.
- Content:
  ```dockerfile
  FROM liveclawbench-weather-outdoor-window-base:latest
  ```
- Acceptance check:
  - `docker build -t liveclawbench-weather-outdoor-window tasks/weather-outdoor-window/environment/` succeeds (requires base image built by setup.sh).
- Depends on: Step 1 (base image must exist), Step 3

### Step 7: Write tests/verify.py

- Purpose: Score the agent's output on three dimensions.
- Files: `tasks/weather-outdoor-window/tests/verify.py`
- Actions:
  - Read `/workspace/output/exercise_window.json`.
  - Parse JSON; if missing or malformed → reward 0.0, exit 1.
  - Dim1 (0.4): `isinstance(start_hour, int) and start_hour == 0` → 0.4 or 0.0
  - Dim2 (0.4): `isinstance(end_hour, int) and end_hour == 9` → 0.4 or 0.0
  - Dim3 (0.2): `isinstance(duration_hours, int) and duration_hours == 10` → 0.2 or 0.0
  - Sum reward; create `/logs/verifier/`; write `reward.txt` (scalar) and `reward.json`.
  - Print `Score: {reward}/1.0`; exit 1 if reward < 0.5.
- reward.json schema:
  ```json
  {
    "reward": 1.0,
    "dim_start": 0.4,
    "dim_end": 0.4,
    "dim_duration": 0.2,
    "start_got": 0,
    "end_got": 9,
    "duration_got": 10
  }
  ```
- Acceptance check:
  - Feeding correct JSON → reward 1.0, exit 0.
  - Feeding correct start and end only → reward 0.8, exit 0.
  - Missing file → reward 0.0, exit 1.
  - Feeding float values (e.g. `"start_hour": 0.0`) → dim=0.0 (integer type guard fails).
- Depends on: Step 3

### Step 8: Write tests/test.sh

- Purpose: Orchestrate verifier execution in harbor container.
- Files: `tasks/weather-outdoor-window/tests/test.sh`
- Actions:
  - Create `/logs/verifier/`.
  - Run `python3 /tests/verify.py`.
  - Exit with verify.py's exit code (do not suppress).
- Content:
  ```bash
  #!/usr/bin/env bash
  set -e
  mkdir -p /logs/verifier
  python3 /tests/verify.py
  ```
- Acceptance check:
  - Script has LF line endings, shebang, executable bit.
  - `set -e` ensures exit code propagation.
- Depends on: Step 7

### Step 9: Write solution/solve.sh

- Purpose: Provide oracle reference solution for CI and evaluation.
- Files: `tasks/weather-outdoor-window/solution/solve.sh`
- Actions:
  - Fetch `/location/shanghai/hourly`, parse 24 today-rows extracting 时间 and 降水(mm).
  - Qualify hours where precip_mm == "0.0" (exact string or float 0.0 comparison).
  - Run longest-continuous-block scan; pick earliest if tied.
  - Write `/workspace/output/exercise_window.json`.
- Acceptance check:
  - Running solve.sh → `/workspace/output/exercise_window.json` created with start_hour=0, end_hour=9, duration_hours=10.
  - Running verify.py after → reward 1.0.
- Depends on: Steps 4–8

---

## 5. Environment And Service Plan

### Base Image

```dockerfile
FROM liveclawbench-weather-outdoor-window-base:latest
```

The per-task base image is built by `setup.sh` step 4 via `mock-platform/scripts/build-task-images.ts`. It contains:
- The `weather` binary at `/opt/mock/bin/weather`
- Startup script at `/opt/mock/startup.d/weather-outdoor-window.sh`
- Shared entrypoint at `/opt/mock/entrypoint.sh` (ends with `exec "$@"`)
- Pre-created `/workspace/output/` directory

### Service Startup

- Weather service starts automatically via the per-task entrypoint when the container launches.
- Service binds to `0.0.0.0:3000`.
- No agent action required to start the service.

### Agent Environment

- `/workspace/output/` exists and is writable.
- `WEATHER_DB_PATH=/tmp/weather.db` (or default path in the binary).
- `allow_internet = true` in task.toml.

---

## 6. Data And State Plan

### Correct Target Data

| field | value | type | source |
|---|---|---|---|
| start_hour | 0 | integer | longest qualifying block starts at hour 0 |
| end_hour | 9 | integer | longest qualifying block ends at hour 9 (inclusive) |
| duration_hours | 10 | integer | end_hour − start_hour + 1 = 10 |

### Qualifying Windows

| block | hours | length | winner |
|---|---|---|---|
| Block A | 0–9 | 10 hours | yes (longest; also earliest) |
| Block B | 21–23 | 3 hours | no (shorter) |

### State Persistence

- Agent writes JSON file; verifier reads it directly.
- No database write required from agent.

### Initial State

- `/workspace/output/exercise_window.json` does not exist at container launch.
- Weather service is running; hourly endpoint returns 24 today + 6 tomorrow rows for Shanghai.

---

## 7. Instruction Plan

### Final instruction.md Content

```
You want to go for an outdoor run in Shanghai today. Check today's hourly forecast at http://localhost:3000/location/shanghai/hourly (open it in your browser) and identify the longest continuous block of time that's suitable for running outdoors. If there are multiple windows of the same length, choose the earliest one. Save your result to /workspace/output/exercise_window.json with the following keys:
- "start_hour" — integer hour (0–23) when the window starts
- "end_hour" — integer hour (0–23, inclusive) when the window ends
- "duration_hours" — integer count of hours in the window (end_hour − start_hour + 1)
```

### Leakage Checklist

- No explicit temperature bounds (10°C, 28°C) mentioned. ✓
- No explicit precipitation threshold (precip == 0) mentioned. ✓
- No oracle answer (0, 9, 10) mentioned. ✓
- No verifier file names mentioned. ✓
- URL uses `http://localhost:3000/location/shanghai/hourly` with "(open it in your browser)". ✓
- Output path is Linux container path. ✓

---

## 8. Verifier And Reward Plan

### Verifier Integrity Trace

| Spec scoring dimension | Weight | Verifier file/function | State read | Failure/partial policy | Zero-work baseline result | Domain-specific assertion |
|---|---:|---|---|---|---|---|
| Dim1: start_hour == 0 | 0.4 | tests/verify.py `dim_start` | `/workspace/output/exercise_window.json` → `start_hour` field (int) | missing file → 0.0 total; wrong int → dim=0.0; non-integer (float/string) → dim=0.0 | 0.0 (file not created) | Correct window starts at midnight (hour 0), not at some later dry hour |
| Dim2: end_hour == 9 | 0.4 | tests/verify.py `dim_end` | same file → `end_hour` field (int) | wrong int → dim=0.0; non-integer → dim=0.0 | 0.0 | Window ends at hour 9 (last dry hour before rain starts at hour 10) |
| Dim3: duration_hours == 10 | 0.2 | tests/verify.py `dim_duration` | same file → `duration_hours` field (int) | wrong int → dim=0.0; non-integer → dim=0.0 | 0.0 | Duration = end_hour − start_hour + 1 = 9 − 0 + 1 = 10 |

**Weight sum**: 0.4 + 0.4 + 0.2 = 1.0 ✓

**Passing threshold**: reward ≥ 0.5. Minimum passing path: Dim1+Dim2 = 0.8 → passes. Dim1 alone = 0.4 → does not pass. Dim2 alone = 0.4 → does not pass. Need at least both start and end correct.

### verify.py Skeleton

```python
#!/usr/bin/env python3
import json, os, sys

OUTPUT_PATH = "/workspace/output/exercise_window.json"
LOG_DIR = "/logs/verifier"
os.makedirs(LOG_DIR, exist_ok=True)

def write_reward(reward, dim_start, dim_end, dim_duration, start_got, end_got, duration_got):
    with open(f"{LOG_DIR}/reward.txt", "w") as f:
        f.write(str(reward))
    with open(f"{LOG_DIR}/reward.json", "w") as f:
        json.dump({
            "reward": reward,
            "dim_start": dim_start,
            "dim_end": dim_end,
            "dim_duration": dim_duration,
            "start_got": start_got,
            "end_got": end_got,
            "duration_got": duration_got
        }, f)

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

dim_start    = 0.4 if isinstance(start_hour, int) and start_hour == 0 else 0.0
dim_end      = 0.4 if isinstance(end_hour, int) and end_hour == 9 else 0.0
dim_duration = 0.2 if isinstance(duration_hours, int) and duration_hours == 10 else 0.0

reward = dim_start + dim_end + dim_duration
write_reward(
    reward, dim_start, dim_end, dim_duration,
    start_hour if isinstance(start_hour, int) else -1,
    end_hour if isinstance(end_hour, int) else -1,
    duration_hours if isinstance(duration_hours, int) else -1
)
print(f"Score: {reward}/1.0")
sys.exit(0 if reward >= 0.5 else 1)
```

---

## 9. Reference Solution Plan

Oracle values (hidden from instruction.md): start_hour=0, end_hour=9, duration_hours=10.

A production solve.sh should:
1. `curl http://localhost:3000/location/shanghai/hourly` to get the hourly HTML.
2. Parse the 24 today-rows extracting the 时间 (hour) and 降水(mm) columns.
3. Mark each hour as qualifying if precip_mm == 0.0 (or "0.0").
4. Scan qualifying hours for the longest consecutive run; if tied, pick earliest.
5. Write `/workspace/output/exercise_window.json`.

---

## 10. Validation And Audit Plan

1. `python scripts/validate_tasks.py`
2. `python scripts/validate_annotations.py`
3. Static checks: ruff format/check on verify.py; bash -n on test.sh and solve.sh.
4. Docker build check.
5. Oracle-run reward check: solve.sh → verify.py → expect reward=1.0.
6. Zero-work reward check: verify.py without agent → expect reward=0.0.

---

## 11. Risks And Open Questions

### R-01: today vs. tomorrow rows in HTML

- Issue: `/location/shanghai/hourly` renders 24 today + 6 tomorrow rows. Agent must not accidentally include tomorrow's rows in the window search.
- Blocking impact: Low — today's rows are labeled with the current date column.
- Suggested resolution: solve.sh can extract only today's 24 rows by date header or by counting first 24 data rows.

### R-02: Precip rendering precision

- Issue: The HTML renders precip as "0.4" (rounded from 4/11 ≈ 0.364). Agent string-comparing "0.0" vs "0.4" is simpler than float parsing.
- Blocking impact: None — "0.4" is clearly non-zero; agent's heuristic of "any non-zero precipitation = rain" will work correctly.
- Suggested resolution: No action needed. Agents treating any non-"0.0" precip as rain will produce the correct window.

### R-03: reward.json field naming (no _meta_ prefix)

- Issue: All reward.json fields (`start_got`, `end_got`, `duration_got`) are integer diagnostics — no `_meta_` prefix needed since they are numeric.
- Blocking impact: None — harbor accepts `dict[str, float | int]`; all fields are numeric. ✓

---

## Domain-Specific Data Trace

| Domain checklist item | Spec fact preserved | Plan-added concrete detail | Seed/fixture action | Verifier assertion |
|---|---|---|---|---|
| Plausible outdoor exercise conditions | Temp 18–22°C all qualify; precipitation is the differentiator | Typical outdoor running guidance: avoid rain; temperature range is comfortable (no heat/cold extremes) — temperature is never binding for this seed | seed.ts: temp_high=22, temp_low=18 for Shanghai; hourly formula produces 18–22°C for all 24 hours | seed-only (temp never triggers disqualification) |
| Precipitation as the key signal | Hours 10–20 have precip=0.4mm (rain); hours 0–9 and 21–23 have precip=0.0 | 4mm daily spread over 11 hours (10–20 inclusive); rendered as "0.4" in HTML; "0.0" elsewhere | seed.ts: daily_precip=4 for Shanghai; hourly rendering uses `precip / 11` for rain hours | Dim1+Dim2: start_hour==0 and end_hour==9 (implicitly assert the precipitation filter was applied correctly) |
| Longest-window algorithm required | Two qualifying blocks: 0–9 (10h) and 21–23 (3h); winner is 0–9 | Agent must implement a longest-continuous-run scan rather than just picking the first qualifying hour | seed data deterministic; both blocks are present | Dim3: `duration_hours == 10` (must be 10, not 3 — shows agent found the longer block) |
| Integer output required | start_hour, end_hour, duration_hours must all be integers | Float output (e.g. from JSON.parse returning 0 as a float in some languages) would fail type guards | verifier uses `isinstance(x, int)` not `int(x)` | All three dims include `isinstance(..., int)` guard |
| Earliest-window tiebreaker | Instruction says "choose the earliest one" | No tie occurs in this seed (10h >> 3h), but earliest-first is preserved in instruction verbatim for correctness | deterministic seed has no tie | Not verifier-tested (no tie in data), but instruction preserved |
