You are an isolated plan auditor for LiveClawBench. Do not rewrite or fix the plan. Be strict, concrete, and evidence-based. Mark PASS only when every material issue is absent.

## Your Task

Audit the plan below against the source spec and the rules provided. Check spec preservation, self-containedness, domain-specific trace quality, verifier integrity, reward/test feasibility, zero-work baseline, path realism, and internal consistency. Output exactly the format specified at the end.

---

## Source Spec

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

---

## Plan To Audit

# Plan: weather-city-travel-pick

## 1. Plan Metadata

- **task_name**: weather-city-travel-pick
- **source_spec**: context_create_pipeline/spec_creation_audits/weather-city-travel-pick.md
- **target_task_dir**: tasks/weather-city-travel-pick/
- **case_id**: 110
- **difficulty**: hard
- **domain**: Health & Wellness
- **domains_multi**: Health & Wellness
- **factors_supported**: A1=0, A2=0, B1=1, B2=0
- **mock_app_sources**: mock-platform/mocks/weather/ (Bun+Hono, binary: `weather`, port 3000)
- **expected_outputs**: /workspace/output/travel_pick.json
- **spec_snapshot_status**: complete

---

## 2. Context Creation Goal

### Spec Preservation Snapshot

**Task Goal** (preserved from spec §2):
The agent must consult a local weather service covering five Chinese cities, evaluate each city against unstated but inferable comfort and air-quality thresholds, identify the city that best satisfies both constraints, and persist a structured recommendation to a file. The goal is framed as a travel-planning favour with no explicit filtering rules given; the agent must infer what "good air quality" and "comfortable temperatures" mean from the data and domain context.

**Agent Instruction Draft** (preserved from spec §3 — used verbatim in instruction.md):
> A friend is planning a weekend trip and wants to visit a city with good air quality and comfortable temperatures. Check the weather service at http://localhost:3000/ (open it in your browser) for all five available cities. Based on the air quality and temperature data, recommend the city that best meets both criteria. Save your recommendation to `/workspace/output/travel_pick.json` with the following keys:
> - `"city"` — the city name in Chinese
> - `"aqi"` — integer AQI value
> - `"temp_high_c"` — integer high temperature in Celsius
> - `"reason"` — one sentence explaining why this city was chosen

*Hidden from instruction.md (implementer only)*: correct answer is 上海, AQI=35, temp_high_c=22. Agent must infer filter `aqi < 100 AND temp_high_c ∈ [15, 28]` then pick lowest AQI.

**Mock Services / Assets**:
- weather-app binary compiled from `mock-platform/mocks/weather/`
- Port: 3000
- Pre-task base image: `liveclawbench-weather-city-travel-pick-base:latest`
- task-binary-map.json entry: `"weather-city-travel-pick": {"binaries": ["weather"]}`

**Environment / Data Setup**:
- SQLite at `/tmp/weather.db` (env `WEATHER_DB_PATH`)
- Seeded with 5 cities (all deterministic, no external data required)
- Output dir: `/workspace/output/` (pre-created by base image)
- Output file: `/workspace/output/travel_pick.json` (agent writes)

**Pre-seeded City Data**:

| slug | display_name | temp_high_c | AQI | category | qualifies |
|---|---|---|---|---|---|
| beijing | 北京 | 28 | 75 | moderate | yes |
| shanghai | 上海 | 22 | 35 | good | yes (winner) |
| shenzhen | 深圳 | 30 | 28 | good | no (temp > 28) |
| chengdu | 成都 | 23 | 120 | unhealthy_sensitive | no (AQI ≥ 100) |
| harbin | 哈尔滨 | 12 | 22 | good | no (temp < 15) |

**Expected Behavior / Reference Path** (preserved from spec §5):
1. Agent discovers city list via `GET /api/locations` or browsing `http://localhost:3000/`.
2. For each city, fetches AQI and temp_high_c.
3. Applies filter: `aqi < 100 AND temp_high_c >= 15 AND temp_high_c <= 28` → qualifying: 北京, 上海.
4. Picks lowest AQI → 上海 (35).
5. Writes `/workspace/output/travel_pick.json`.

**Verifier Design** (preserved from spec §6):

| Dim | Weight | State Read | Criterion | Partial Credit |
|---|---|---|---|---|
| 1 | 0.4 | `city` | equals `上海` | none |
| 2 | 0.3 | `aqi` | equals `35` (int) | none |
| 3 | 0.3 | `temp_high_c` | within ±1 of `22` | none |

- Missing/invalid JSON → reward 0.0, exit 1
- Zero-work baseline: 0.0
- reward.txt: scalar float; reward.json: `{"reward": X, "dim_city": Y, "dim_aqi": Z, "dim_temp": W, "_meta_city_got": "...", "_meta_aqi_got": N}`
- Score: X.X/1.0; exit non-zero if score < 0.5

**Required Files** (from spec §7):
- tasks/weather-city-travel-pick/task.toml
- tasks/weather-city-travel-pick/instruction.md
- tasks/weather-city-travel-pick/environment/Dockerfile
- tasks/weather-city-travel-pick/solution/solve.sh
- tasks/weather-city-travel-pick/tests/test.sh
- tasks/weather-city-travel-pick/tests/verify.py

**Implementation Pitfalls** (from spec §8):
- `city` must be Chinese `上海`, not ASCII `Shanghai`
- `aqi` and `temp_high_c` must be integers
- Weather mock is date-aware; seed values are deterministic regardless of run date
- B1=1: instruction omits thresholds; agent infers from domain knowledge and AQI category labels
- `reason` field is free-text, not verified
- Dockerfile base: `liveclawbench-weather-city-travel-pick-base:latest`

---

## 3. Source Assets And Reuse Map

| Source | Target | Action | Notes |
|---|---|---|---|
| mock-platform/mocks/weather/ | (compiled binary in base image) | Reuse — binary already in `liveclawbench-weather-city-travel-pick-base:latest` | No additional copy needed; setup.sh builds the per-task base image |
| mock-platform/config/task-binary-map.json | same file | Add entry `"weather-city-travel-pick": {"binaries": ["weather"]}` | Required for setup.sh step 4 to build the per-task base image |
| context_create_pipeline/spec_creation_audits/weather-city-travel-pick.md | (this plan) | Reference only | Spec is the authority; do not copy into task directory |
| tasks/weather-city-travel-pick/task.toml | new file | Create from spec §1 task.toml block | |
| tasks/weather-city-travel-pick/instruction.md | new file | Create from spec §3 instruction draft | Exclude hidden oracle data |
| tasks/weather-city-travel-pick/environment/Dockerfile | new file | Create; FROM liveclawbench-weather-city-travel-pick-base:latest | Minimal — no additional app needed |
| tasks/weather-city-travel-pick/solution/solve.sh | new file | Create oracle solution | Calls API endpoints, computes answer, writes JSON |
| tasks/weather-city-travel-pick/tests/test.sh | new file | Create; invokes verify.py, writes reward.txt | Must not suppress exit code |
| tasks/weather-city-travel-pick/tests/verify.py | new file | Create; reads travel_pick.json, scores 3 dims | |

---

## 4. Step-By-Step Build Plan

### Step 1: Add task-binary-map.json entry

- Purpose: Enable setup.sh step 4 to build `liveclawbench-weather-city-travel-pick-base:latest` with the weather binary.
- Files: `mock-platform/config/task-binary-map.json`
- Actions:
  - Add `"weather-city-travel-pick": {"binaries": ["weather"]}` to the JSON object.
- Acceptance check:
  - `jq '."weather-city-travel-pick"' mock-platform/config/task-binary-map.json` → `{"binaries": ["weather"]}`
- Depends on: none

### Step 2: Create task directory skeleton

- Purpose: Establish the standard task file tree.
- Files: `tasks/weather-city-travel-pick/` (directory tree)
- Actions:
  - Create directories: `tasks/weather-city-travel-pick/`, `environment/`, `solution/`, `tests/`
- Acceptance check:
  - All four directories exist.
- Depends on: none

### Step 3: Write task.toml

- Purpose: Encode difficulty, domain, factors, timeouts, and allow_internet.
- Files: `tasks/weather-city-travel-pick/task.toml`
- Actions:
  - Write from spec §1 task.toml block verbatim; verify `allow_internet = true`.
- Content:
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
- Acceptance check:
  - `python scripts/validate_tasks.py` passes for this task.
  - `python scripts/validate_annotations.py` passes.
- Depends on: Step 2

### Step 4: Write instruction.md

- Purpose: Produce the agent-facing prompt without leaking oracle data or explicit thresholds.
- Files: `tasks/weather-city-travel-pick/instruction.md`
- Actions:
  - Copy spec §3 instruction draft verbatim (B1=1 compliant — no thresholds).
- Content:
  ```
  A friend is planning a weekend trip and wants to visit a city with good air quality and comfortable temperatures. Check the weather service at http://localhost:3000/ (open it in your browser) for all five available cities. Based on the air quality and temperature data, recommend the city that best meets both criteria. Save your recommendation to /workspace/output/travel_pick.json with the following keys:
  - "city" — the city name in Chinese
  - "aqi" — integer AQI value
  - "temp_high_c" — integer high temperature in Celsius
  - "reason" — one sentence explaining why this city was chosen
  ```
- Acceptance check:
  - No numeric threshold (10, 28, 100, 15) appears in the file.
  - No oracle answer (上海, 35, 22) appears.
  - URL uses `http://localhost:3000/` with "open it in your browser".
- Depends on: Step 2

### Step 5: Write environment/Dockerfile

- Purpose: Define the task container environment. The mock service is already embedded in the per-task base image; no additional app to install.
- Files: `tasks/weather-city-travel-pick/environment/Dockerfile`
- Actions:
  - Write minimal Dockerfile inheriting from the per-task base image.
- Content:
  ```dockerfile
  FROM liveclawbench-weather-city-travel-pick-base:latest
  ```
- Acceptance check:
  - `docker build -t liveclawbench-weather-city-travel-pick tasks/weather-city-travel-pick/environment/` succeeds (requires base image built by setup.sh).
- Depends on: Step 1 (base image must exist), Step 2

### Step 6: Write tests/verify.py

- Purpose: Score the agent's output on three dimensions.
- Files: `tasks/weather-city-travel-pick/tests/verify.py`
- Actions:
  - Read `/workspace/output/travel_pick.json`.
  - Parse JSON; if missing or malformed → reward 0.0, exit 1.
  - Dim1 (0.4): `city == "上海"` → 0.4 or 0.0
  - Dim2 (0.3): `isinstance(aqi, int) and aqi == 35` → 0.3 or 0.0
  - Dim3 (0.3): `isinstance(temp_high_c, int) and abs(temp_high_c - 22) <= 1` → 0.3 or 0.0
  - Sum reward; create `/logs/verifier/`; write `reward.txt` (scalar) and `reward.json`.
  - Print `Score: {reward}/1.0`; exit 1 if reward < 0.5.
- reward.json schema:
  ```json
  {
    "reward": 1.0,
    "dim_city": 0.4,
    "dim_aqi": 0.3,
    "dim_temp": 0.3,
    "_meta_city_got": "上海",
    "_meta_aqi_got": 35
  }
  ```
- Acceptance check:
  - Feeding correct JSON `{"city":"上海","aqi":35,"temp_high_c":22,"reason":"..."}` → reward 1.0, exit 0.
  - Feeding wrong city → reward 0.6 (dim_aqi + dim_temp), exit 0.
  - Missing file → reward 0.0, exit 1.
  - Feeding `{"city":"Shanghai","aqi":35,"temp_high_c":22,"reason":"..."}` → dim_city=0.0 (ASCII mismatch).
- Depends on: Step 2

### Step 7: Write tests/test.sh

- Purpose: Orchestrate verifier execution in harbor container.
- Files: `tasks/weather-city-travel-pick/tests/test.sh`
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
- Depends on: Step 6

### Step 8: Write solution/solve.sh

- Purpose: Provide oracle reference solution for CI and evaluation.
- Files: `tasks/weather-city-travel-pick/solution/solve.sh`
- Actions:
  - Call `GET /api/locations` to enumerate cities.
  - For each city, call `GET /api/location/{slug}/air-quality` and parse HTML for temp_high_c.
  - Apply filter: aqi < 100 AND temp_high_c in [15, 28].
  - Pick city with lowest AQI.
  - Write `/workspace/output/travel_pick.json`.
- Acceptance check:
  - Running solve.sh → `/workspace/output/travel_pick.json` created.
  - Running verify.py after solve.sh → reward 1.0.
- Depends on: Steps 3–7

---

## 5. Environment And Service Plan

### Base Image

```dockerfile
FROM liveclawbench-weather-city-travel-pick-base:latest
```

The per-task base image is built by `setup.sh` step 4 via `mock-platform/scripts/build-task-images.ts`. It contains:
- The `weather` binary at `/opt/mock/bin/weather`
- Startup script at `/opt/mock/startup.d/weather-city-travel-pick.sh`
- Shared entrypoint at `/opt/mock/entrypoint.sh` (ends with `exec "$@"`)
- Pre-created `/workspace/output/` directory

### Service Startup

- Weather service starts automatically via the per-task entrypoint when the container launches.
- Service binds to `0.0.0.0:3000`.
- No agent action required to start the service.

### Agent Environment

- `/workspace/output/` exists and is writable.
- `WEATHER_DB_PATH=/tmp/weather.db` (or default path in the binary).
- `allow_internet = true` in task.toml (required for OpenClaw LLM API calls).

### No Additional COPY Steps

The Dockerfile is intentionally minimal — all mock infrastructure is in the base image. No extra files to copy.

---

## 6. Data And State Plan

### Correct Target Data

| field | value | type | source |
|---|---|---|---|
| city | 上海 | string (Chinese) | seed.ts → shanghai.display_name |
| aqi | 35 | integer | seed.ts → shanghai.aqi |
| temp_high_c | 22 | integer | seed.ts → shanghai.today.temp_high_c |
| reason | any string | string | agent-generated, not verified |

### Distractor Cities (designed to be plausible but non-qualifying)

| city | reason eliminated | purpose |
|---|---|---|
| 北京 (AQI=75, temp=28°C) | qualifies but loses to 上海 by AQI | near-miss — forces AQI comparison |
| 深圳 (AQI=28, temp=30°C) | temp > 28°C | tests temperature upper bound; low AQI misleads |
| 成都 (AQI=120, temp=23°C) | AQI ≥ 100 | tests AQI threshold; comfortable temp misleads |
| 哈尔滨 (AQI=22, temp=12°C) | temp < 15°C | tests temperature lower bound; lowest AQI misleads |

### Initial State

- `/workspace/output/travel_pick.json` does not exist at container launch.
- Weather service is running; SQLite DB is seeded with deterministic values.

### Final State (after agent completes task)

- `/workspace/output/travel_pick.json` exists and contains valid JSON with all four required keys.

### State Persistence

- Agent writes the JSON file; verifier reads it directly.
- No database write is required from the agent.

---

## 7. Instruction Plan

### Final instruction.md Content

```
A friend is planning a weekend trip and wants to visit a city with good air quality and comfortable temperatures. Check the weather service at http://localhost:3000/ (open it in your browser) for all five available cities. Based on the air quality and temperature data, recommend the city that best meets both criteria. Save your recommendation to /workspace/output/travel_pick.json with the following keys:
- "city" — the city name in Chinese
- "aqi" — integer AQI value
- "temp_high_c" — integer high temperature in Celsius
- "reason" — one sentence explaining why this city was chosen
```

### Leakage Checklist

- No explicit AQI threshold (100) mentioned. ✓
- No explicit temperature bounds (15°C, 28°C) mentioned. ✓
- No oracle answer (上海, 35, 22) mentioned. ✓
- No verifier file names mentioned. ✓
- URL uses `http://localhost:3000/` with "(open it in your browser)". ✓
- Output path is Linux container path. ✓

---

## 8. Verifier And Reward Plan

### Verifier Integrity Trace

| Spec scoring dimension | Weight | Verifier file/function | State read | Failure/partial policy | Zero-work baseline result | Domain-specific assertion |
|---|---:|---|---|---|---|---|
| Dim1: city == 上海 | 0.4 | tests/verify.py `dim_city` | `/workspace/output/travel_pick.json` → `city` field (string) | missing file → 0.0 total; wrong string → dim=0.0; ASCII "Shanghai" → dim=0.0 | 0.0 (file not created) | City name must be Chinese 上海 (UTF-8), not ASCII transliteration |
| Dim2: aqi == 35 | 0.3 | tests/verify.py `dim_aqi` | same file → `aqi` field (int) | wrong value or float type → 0.0; string "35" → 0.0 | 0.0 | AQI is an integer air-quality index; exact match required |
| Dim3: temp_high_c within ±1 of 22 | 0.3 | tests/verify.py `dim_temp` | same file → `temp_high_c` field (int) | out of range [21, 23] → 0.0; non-integer → 0.0 | 0.0 | Represents today's high temperature in °C from daily forecast |

**Weight sum**: 0.4 + 0.3 + 0.3 = 1.0 ✓

**Zero-work baseline**: 0.0 — file does not pre-exist in the image; agent must create it.

**Passing threshold**: reward ≥ 0.5. Minimum passing path: Dim1 alone (city correct) = 0.4 — does not pass; Dim1 + Dim2 = 0.7 — passes. Or Dim1 + Dim3 = 0.7 — passes.

### verify.py Skeleton

```python
#!/usr/bin/env python3
import json, os, sys

OUTPUT_PATH = "/workspace/output/travel_pick.json"
LOG_DIR = "/logs/verifier"
os.makedirs(LOG_DIR, exist_ok=True)

def write_reward(reward, dim_city, dim_aqi, dim_temp, city_got, aqi_got):
    with open(f"{LOG_DIR}/reward.txt", "w") as f:
        f.write(str(reward))
    with open(f"{LOG_DIR}/reward.json", "w") as f:
        json.dump({
            "reward": reward,
            "dim_city": dim_city,
            "dim_aqi": dim_aqi,
            "dim_temp": dim_temp,
            "_meta_city_got": str(city_got),
            "_meta_aqi_got": int(aqi_got) if isinstance(aqi_got, (int, float)) else -1
        }, f)

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

dim_city = 0.4 if city == "上海" else 0.0
dim_aqi  = 0.3 if isinstance(aqi, int) and aqi == 35 else 0.0
dim_temp = 0.3 if isinstance(temp, int) and abs(temp - 22) <= 1 else 0.0

reward = dim_city + dim_aqi + dim_temp
write_reward(reward, dim_city, dim_aqi, dim_temp, city, aqi if aqi is not None else -1)
print(f"Score: {reward}/1.0")
sys.exit(0 if reward >= 0.5 else 1)
```

### test.sh Content

```bash
#!/usr/bin/env bash
set -e
mkdir -p /logs/verifier
python3 /tests/verify.py
```

---

## 9. Reference Solution Plan

### Oracle Route (full reward)

Oracle values (hidden from instruction.md): city=上海, aqi=35, temp_high_c=22.

A production solve.sh should: enumerate slugs via `/api/locations`, fetch AQI via `/api/location/{slug}/air-quality`, parse temp_high_c from HTML at `/location/{slug}`, apply filter, pick lowest AQI, write JSON.

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

### R-01: temp_high_c data source for agent

- Issue: No JSON API for temperature; agent must parse HTML at /location/{slug} or /location/{slug}/daily.
- Blocking impact: Low — HTML pages show temperature prominently.
- Suggested resolution: solve.sh oracle can use HTML parsing or hardcode known values.

### R-02: _meta_aqi_got is integer but uses _meta_ prefix

- Issue: _meta_aqi_got stores a numeric value; _meta_ prefix is technically for non-numeric fields.
- Blocking impact: None — Harbor accepts integer values.
- Suggested resolution: Keep as-is per spec §6.

---

## Domain-Specific Data Trace

| Domain checklist item | Spec fact preserved | Plan-added concrete detail | Seed/fixture action | Verifier assertion |
|---|---|---|---|---|
| Plausible AQI ranges | AQI: 22, 28, 35, 75, 120 (5 cities) | AQI on standard US AQI scale; category labels match EPA bands (good/moderate/unhealthy_sensitive); all within realistic urban China ranges | seed.ts defines deterministic AQI per city | Dim2: `aqi == 35` (int); exact integer match |
| Plausible temperature ranges | temp_high_c: 12, 22, 23, 28, 30 (5 cities) | Realistic daily highs for Chinese cities in spring/early summer | seed.ts defines deterministic temp_high_c per city | Dim3: `abs(temp_high_c - 22) <= 1` |
| No medical claims; task is travel comfort | "comfortable temperatures" and "good air quality" — natural travel language | AQI categories in API (good/moderate/unhealthy_sensitive) provide domain grounding without explicit threshold | AQI category strings in seed data | seed-only, no verifier read |
| Correct target plus meaningful distractors | 5 cities; 3 eliminated by different failure modes | 深圳: low AQI=28 but temp=30 (temp trap); 哈尔滨: lowest AQI=22 but temp=12 (cold trap); 成都: comfortable temp=23 but AQI=120 (AQI trap); 北京: qualifies but AQI=75 > 上海's 35 (comparison step) | All 5 cities seeded in seed.ts | Dim1: `city == "上海"` — must select winner, not nearest distractor (北京) |
| Chinese city display names | city must be Chinese 上海, not ASCII Shanghai | Verifier uses exact UTF-8 string comparison | seed.ts: display_name = "上海" for shanghai slug | `city == "上海"` exact UTF-8 string match |

---

## Generation Standard Rules (for auditor reference)

The plan must be a self-contained augmentation of the source spec. Required sections in order: Plan Metadata, Context Creation Goal, Source Assets And Reuse Map, Step-By-Step Build Plan, Environment And Service Plan, Data And State Plan, Instruction Plan, Verifier And Reward Plan, Reference Solution Plan, Validation And Audit Plan, Risks And Open Questions. Must include Spec Preservation Snapshot, Domain-Specific Data Trace, and Verifier Integrity Trace.

## Verifier Integrity Rules (for auditor reference)

- Every scoring dimension from the spec must appear in Verifier Integrity Trace.
- Weights must sum to 1.0.
- Every row must identify verifier file/function and state read.
- Every row must describe missing/malformed/partial behavior.
- Zero-work baseline must be 0.0 or explicitly guarded.
- reward.json: `reward` mandatory; non-numeric fields use `_meta_` prefix.
- test.sh must create `/logs/verifier`, write `reward.txt`, preserve exit status, use `/tests/` path (not `/workspace/tests/`).

## Domain-Specific Trace Rules (for auditor reference)

- Health & Wellness domain: use plausible units and ranges; avoid medical claims; include distractors.
- Table must have at least 3 rows for main domain.
- Each row must name concrete fields, objects, files, or state paths.
- Every verifier-reading row must match a Verifier Integrity Trace row.

---

## Required Output Format

```markdown
# Audit Round 1: weather-city-travel-pick

STATUS: PASS|FAIL

## Summary
<brief summary>

## Findings
| issue_id | severity | checklist_source | plan_section | evidence | required_fix | status |
|---|---|---|---|---|---|---|

## Previous Round Verification
Not applicable.

## Spec Preservation Check
<whether critical spec facts were preserved>

## Domain-Specific Trace Check
<whether the plan has concrete domain-specific data/verifier traces>

## Verifier Integrity Check
<whether verifier/reward/testing plan is robust>

## Unresolved Issue Summary
<only unresolved issues; write None if PASS>
```
