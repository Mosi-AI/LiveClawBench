# Implement weather-city-travel-pick (case_id=110): B1 Travel Destination Picker

## Goal Description

Create all task files for the `weather-city-travel-pick` LiveClawBench benchmark task. This is a hard Health & Wellness task with B1=1 (Implicit Goal Resolution): an agent consults a local weather service covering five Chinese cities, must infer—without being told—what "good air quality" and "comfortable temperatures" mean, identify the optimal travel destination (上海), and persist the recommendation as structured JSON.

The implementation covers: registering the task in both metadata indices (task-binary-map.json and cases_registry.csv), and creating the full task directory with all six required files (task.toml, instruction.md, environment/Dockerfile, tests/verify.py, tests/test.sh, solution/solve.sh). The instruction must contain no explicit numeric thresholds or oracle values; the verifier must enforce exact UTF-8 city name and integer type checks.

## Acceptance Criteria

Following TDD philosophy, each criterion includes positive and negative tests for deterministic verification.

- AC-1: `mock-platform/config/task-binary-map.json` and `mock-platform/scripts/build-task-images.ts` are updated for `weather-city-travel-pick`
  - Positive Tests (expected to PASS):
    - `jq '.tasks."weather-city-travel-pick"' mock-platform/config/task-binary-map.json` returns `{"binaries":["weather"]}` (entry is under the `"tasks"` key, not top-level)
    - `"weather-city-travel-pick"` appears in `ALL_TASK_NAMES` set in `mock-platform/scripts/build-task-images.ts`
    - Running `bun run build:images` from mock-platform/ builds a `liveclawbench-weather-city-travel-pick-base:latest` image successfully
  - Negative Tests (expected to FAIL):
    - Adding entry at the top level (not under `"tasks"`) causes the build script to not find the task mapping
    - Omitting the task from `ALL_TASK_NAMES` causes `build-task-images.ts` schema validation to fail for the new task

- AC-2: Both registry CSVs and `complexity-framework.md` contain the `weather-city-travel-pick` entry
  - Positive Tests (expected to PASS):
    - `grep "^110," docs/metadata/cases_registry.csv` returns exactly one line with all correct fields
    - `grep "^110," docs/metadata/cases_registry_zh.csv` returns exactly one line
    - `grep "weather-city-travel-pick" docs/en/reference/complexity-framework.md` returns a table row with `H`, `✓` in B1 column, `Health & Wellness` domain
    - `python scripts/validate_annotations.py` exits 0 after all three sources are updated
  - Negative Tests (expected to FAIL):
    - Adding only to `cases_registry.csv` but not `cases_registry_zh.csv` causes `validate_annotations.py` to report missing entry in `cases_registry_zh`
    - Adding CSV rows but not updating `complexity-framework.md` causes `[toml↔framework]` error once task.toml is created
    - Adding a duplicate `110,` row causes `validate_annotations.py` to report a duplicate case_id error

- AC-3: `tasks/weather-city-travel-pick/task.toml` is valid and matches spec metadata exactly
  - Positive Tests (expected to PASS):
    - `python scripts/validate_tasks.py` exits 0 for this task with no errors
    - File contains `case_id = 110`, `difficulty = "hard"`, `factor_b1 = 1`, `allow_internet = true`
    - `python scripts/validate_annotations.py` exits 0 after both AC-2 and AC-3 are satisfied
  - Negative Tests (expected to FAIL):
    - Changing `factor_b1 = 0` causes `validate_annotations.py` to report annotation mismatch
    - Removing `allow_internet = true` does not break validation but would cause runtime failure
    - Adding deprecated `capability_dimension` field causes `validate_tasks.py` to flag an error

- AC-4: `tasks/weather-city-travel-pick/instruction.md` is B1=1 compliant
  - Positive Tests (expected to PASS):
    - File contains the exact spec §3 instruction text verbatim
    - `grep -c "localhost:3000" tasks/weather-city-travel-pick/instruction.md` returns 1
    - No numeric threshold appears (grep for `15`, `28`, `100` in file returns no meaningful hits)
  - Negative Tests (expected to FAIL):
    - File containing "aqi < 100" or "temp_high_c >= 15" would violate B1=1 and leak thresholds
    - File containing "上海" or "35" or "22" would leak the oracle answer

- AC-5: `tasks/weather-city-travel-pick/environment/Dockerfile` uses the correct per-task base image
  - Positive Tests (expected to PASS):
    - File contains exactly `FROM liveclawbench-weather-city-travel-pick-base:latest` as the only instruction
    - `docker build -t liveclawbench-weather-city-travel-pick tasks/weather-city-travel-pick/environment/` succeeds (requires base image from AC-1)
  - Negative Tests (expected to FAIL):
    - Using `FROM liveclawbench-base:latest` (wrong base) omits the weather binary and startup script
    - Using any Windows absolute path causes harbor's build to fail

- AC-6: `tasks/weather-city-travel-pick/tests/verify.py` correctly implements the 3-dimension reward function
  - Positive Tests (expected to PASS):
    - Feeding `{"city":"上海","aqi":35,"temp_high_c":22,"reason":"x"}` → reward=1.0, exit 0, reward.txt contains "1.0"
    - Feeding `{"city":"上海","aqi":35,"temp_high_c":21,"reason":"x"}` (temp ±1) → reward=1.0, exit 0 (±1 tolerance)
    - Feeding `{"city":"北京","aqi":35,"temp_high_c":22,"reason":"x"}` → reward=0.6 (dim_aqi+dim_temp), exit 0
    - Missing file → reward=0.0, exit 1, reward.txt contains "0.0"
    - `reward.json` contains `"reward"`, `"dim_city"`, `"dim_aqi"`, `"dim_temp"`, `"_meta_city_got"`, `"_meta_aqi_got"` keys
  - Negative Tests (expected to FAIL):
    - Feeding `{"city":"Shanghai","aqi":35,"temp_high_c":22,"reason":"x"}` → dim_city=0.0 (ASCII mismatch)
    - Feeding `{"city":"上海","aqi":35.0,"temp_high_c":22,"reason":"x"}` → dim_aqi=0.0 (float not int)
    - Feeding `{"city":"上海","aqi":35,"temp_high_c":20,"reason":"x"}` → dim_temp=0.0 (outside ±1)
    - Running with no output file → exits 1 (blocks harbor from recording a passing score)

- AC-7: `tasks/weather-city-travel-pick/tests/test.sh` correctly invokes the verifier and propagates its exit code
  - Positive Tests (expected to PASS):
    - Script has `#!/usr/bin/env bash` shebang and `set -e`
    - Script calls `python3 /tests/verify.py` (not `/workspace/tests/verify.py`)
    - Script creates `/logs/verifier/` before verify.py runs
    - Running test.sh after a correct agent produces reward.txt at `/logs/verifier/reward.txt`
  - Negative Tests (expected to FAIL):
    - Calling `python3 /workspace/tests/verify.py` (wrong path) would fail inside container
    - Suppressing verify.py exit code (e.g., `python3 /tests/verify.py || true`) would hide verifier failures from harbor

- AC-8: `tasks/weather-city-travel-pick/solution/solve.sh` produces a reward=1.0 when run and verified
  - Positive Tests (expected to PASS):
    - Running solve.sh creates `/workspace/output/travel_pick.json` with `city="上海"`, `aqi=35` (int), `temp_high_c` in [21,23] (int)
    - Running verify.py after solve.sh → reward=1.0, exit 0
  - Negative Tests (expected to FAIL):
    - An oracle that hardcodes values instead of querying the API would fail if seed data ever changes
    - Writing `city: "Shanghai"` (ASCII) or `aqi: 35.0` (float) → verify.py partial/zero score

## Path Boundaries

Path boundaries define the acceptable range of implementation quality and choices.

### Upper Bound (Maximum Acceptable Scope)
The implementation creates all nine artifacts exactly as specified in the draft: task-binary-map.json entry, cases_registry.csv row, full task directory with task.toml, instruction.md, environment/Dockerfile, tests/verify.py (with all type guards and reward.json schema), tests/test.sh, and solution/solve.sh that queries the live API rather than hardcoding values. All tooling validations pass.

### Lower Bound (Minimum Acceptable Scope)
The implementation creates all nine artifacts exactly as specified in the draft. The lower bound is identical to the upper bound.

> **Deterministic Design**: This plan specifies a fully deterministic implementation. All file contents, expected values, type requirements, and API conventions are fixed by the audited spec. The upper and lower bounds converge to a single point. There are no implementation choices to make.

### Allowed Choices
- **Fixed per spec**: All file contents, expected values (`上海`, `35`, `22`), type conventions (int), reward.json field names, and the `_meta_` prefix convention
- Can use: any shell scripting approach in solve.sh that correctly queries `/api/locations` and `/api/location/{slug}/air-quality` and produces integer-typed JSON fields
- Cannot use: hardcoded oracle values in solve.sh, explicit thresholds in instruction.md, non-integer JSON values for `aqi`/`temp_high_c`, ASCII city name instead of UTF-8 `上海`

## Feasibility Hints and Suggestions

> **Note**: This section is for reference and understanding only. These are conceptual suggestions, not prescriptive requirements.

### Conceptual Approach

**solve.sh approach** (one viable path using curl + python3):
```bash
#!/usr/bin/env bash
set -e
BASE="http://localhost:3000"
# Get city slugs
SLUGS=$(curl -s "$BASE/api/locations" | python3 -c "import json,sys; print('\n'.join(c['slug'] for c in json.load(sys.stdin)))")
# For each slug, collect AQI and temp_high_c
# AQI from /api/location/{slug}/air-quality (JSON)
# temp_high_c from /location/{slug}/daily (HTML) — parse with python3/grep
# Apply filter: aqi < 100 AND 15 <= temp_high_c <= 28
# Pick lowest AQI; resolve ties by earliest in list
# Write JSON to /workspace/output/travel_pick.json
```

**verify.py type guard pattern**:
```python
dim_aqi = 0.3 if isinstance(aqi, int) and aqi == 35 else 0.0
# Note: bool is a subclass of int in Python; json.load never returns bool for numbers
```

### Relevant References
- `mock-platform/mocks/weather/src/index.tsx` — weather mock routes; `/api/location/:slug/air-quality` returns `{aqi, category, summary_text}` (JSON)
- `mock-platform/mocks/weather/src/seed.ts` — deterministic seed data; Shanghai: temp_high=22, aqi=35
- `mock-platform/config/task-binary-map.json` — existing entries to match format
- `docs/metadata/cases_registry.csv` — existing rows to match CSV column order
- `tasks/weather-aqi-report/` — sibling weather task for reference on task structure

## Dependencies and Sequence

### Milestones

1. **Metadata Registration**: Register the task in both global metadata indices
   - Register `weather-city-travel-pick` in task-binary-map.json (enables base image build)
   - Append `case_id=110` row to cases_registry.csv (enables validate_annotations.py)

2. **Task Directory Build**: Create the task directory and all six required files
   - Create directory skeleton (`tasks/weather-city-travel-pick/` with `environment/`, `solution/`, `tests/`)
   - Write task.toml from spec §1 verbatim
   - Write instruction.md from spec §3 verbatim (B1-compliant)
   - Write environment/Dockerfile (single FROM line)
   - Write tests/verify.py (3-dim reward function)
   - Write tests/test.sh (verifier runner)
   - Write solution/solve.sh (oracle solution)

3. **Validation**: Confirm all tooling and reward logic is correct
   - `python scripts/validate_tasks.py` passes
   - `python scripts/validate_annotations.py` passes
   - Zero-work reward check: verify.py without agent file → reward=0.0
   - Oracle check: solve.sh → verify.py → reward=1.0

Milestone 2 depends on Milestone 1 being complete (Dockerfile depends on base image name from task-binary-map.json; task.toml depends on case_id confirmed in cases_registry.csv).

## Task Breakdown

Each task must include exactly one routing tag:
- `coding`: implemented by Claude
- `analyze`: executed via Codex (`/humanize:ask-codex`)

| Task ID | Description | Target AC | Tag | Depends On |
|---------|-------------|-----------|-----|------------|
| task1 | Add `"weather-city-travel-pick": {"binaries": ["weather"]}` under `"tasks"` key in mock-platform/config/task-binary-map.json | AC-1 | coding | - |
| task1b | Add `"weather-city-travel-pick"` to `ALL_TASK_NAMES` set in mock-platform/scripts/build-task-images.ts | AC-1 | coding | - |
| task2 | Append case_id=110 row to docs/metadata/cases_registry.csv | AC-2 | coding | - |
| task2b | Append case_id=110 row to docs/metadata/cases_registry_zh.csv | AC-2 | coding | - |
| task2c | Add case_id=110 row to complexity-framework.md annotation table (B1=✓, H, Health & Wellness) | AC-2 | coding | - |
| task3 | Create tasks/weather-city-travel-pick/ directory skeleton (environment/, solution/, tests/) | AC-3..AC-8 | coding | - |
| task4 | Write tasks/weather-city-travel-pick/task.toml | AC-3 | coding | task3 |
| task5 | Write tasks/weather-city-travel-pick/instruction.md | AC-4 | coding | task3 |
| task6 | Write tasks/weather-city-travel-pick/environment/Dockerfile | AC-5 | coding | task1, task3 |
| task7 | Write tasks/weather-city-travel-pick/tests/verify.py | AC-6 | coding | task3 |
| task8 | Write tasks/weather-city-travel-pick/tests/test.sh | AC-7 | coding | task7 |
| task9 | Write tasks/weather-city-travel-pick/solution/solve.sh | AC-8 | coding | task4, task5, task6, task7, task8 |

## Claude-Codex Deliberation

### Agreements
- The implementation plan is fully deterministic: all file contents, expected values, and type conventions are fixed by the audited spec (Stage 2 plan-creation-audit PASS after 2 rounds)
- B1=1 compliance is non-negotiable: instruction.md must contain no explicit thresholds (15°C, 28°C, AQI 100)
- The `_meta_` prefix convention for non-numeric reward.json fields is required by harbor's `dict[str, float|int]` enforcement
- `isinstance(aqi, int)` type guard (not `int(aqi)`) is required to reject float input (e.g., `35.0`)
- `上海` must be exact UTF-8 — ASCII `Shanghai` must produce dim_city=0.0
- task-binary-map.json entries belong under the `"tasks"` key (Codex confirmed, Claude agrees)
- `build-task-images.ts` `ALL_TASK_NAMES` set must include the new task name (Codex confirmed, Claude agrees)
- Both `cases_registry.csv` AND `cases_registry_zh.csv` must be updated (Codex confirmed via validate_annotations.py source)
- `complexity-framework.md` must include the new task row (Codex confirmed; validate_annotations.py raises `[toml↔framework]` error for any task.toml without a framework entry)

### Resolved Disagreements
- **Pass threshold when city is wrong**: Codex flagged that dim_aqi+dim_temp=0.6 ≥ 0.5 allows passing without correct city. Claude position: this is spec-mandated behavior (spec §6, audited and accepted). Not changing — Codex concern is a design opinion, not a correctness error.
- **task-binary-map.json and build-task-images.ts gaps**: Codex correctly identified two missing build steps. Resolved by adding task1b and tasks 2b/2c to Task Breakdown.
- **cases_registry_zh.csv and complexity-framework.md gaps**: Codex correctly identified two missing metadata steps. Resolved by adding tasks 2b and 2c.

### Convergence Status
- Final Status: `converged` (Codex first-pass analysis completed; all material technical gaps incorporated into the plan; remaining concerns are design-opinion differences already settled by the audited spec)

## Pending User Decisions

No pending user decisions. All design parameters are fully specified by the audited Stage 2 plan and require no user input.

## Implementation Notes

### Code Style Requirements
- Implementation code and comments must NOT contain plan-specific terminology such as "AC-", "Milestone", "Step", "Phase", or similar workflow markers
- These terms are for plan documentation only, not for the resulting codebase
- Use descriptive, domain-appropriate naming in code instead
- verify.py must use Python standard library only (json, os, sys) — no third-party imports
- solve.sh may use bash, curl, and python3 (available in the container) — no additional dependencies

--- Original Design Draft Start ---

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
| docs/metadata/cases_registry.csv | same file | Append one new row for case_id=110 | Required by CLAUDE.md and cross-checked by `validate_annotations.py` |
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

### Step 2: Add cases_registry.csv row

- Purpose: Register case_id=110 in the task metadata index so that `validate_annotations.py` passes and the task is discoverable in the benchmark corpus.
- Files: `docs/metadata/cases_registry.csv`
- Actions:
  - Read the current file to confirm the header and current last row.
  - Append the following row (no trailing newline beyond the file's existing convention):
    ```
    110,proactive decision making,weather-city-travel-pick,Agent must query weather and AQI data for five cities and identify the optimal travel destination satisfying implicit temperature and air-quality constraints.,H,Evaluates the agent's ability to implicitly infer temperature and air-quality thresholds from domain context and identify the optimal city by combining multi-endpoint weather and AQI data,Health & Wellness,Health & Wellness,0,0,1,0,planned
    ```
- Acceptance check:
  - `grep "^110," docs/metadata/cases_registry.csv` returns exactly one line matching the row above.
  - `python scripts/validate_annotations.py` passes (no duplicate or missing case_id errors).
- Depends on: none

### Step 3: Create task directory skeleton

- Purpose: Establish the standard task file tree.
- Files: `tasks/weather-city-travel-pick/` (directory tree)
- Actions:
  - Create directories: `tasks/weather-city-travel-pick/`, `environment/`, `solution/`, `tests/`
- Acceptance check:
  - All four directories exist.
- Depends on: none

### Step 4: Write task.toml

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
- Depends on: Step 3

### Step 5: Write instruction.md

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
- Depends on: Step 3

### Step 6: Write environment/Dockerfile

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
- Depends on: Step 1 (base image must exist), Step 3

### Step 7: Write tests/verify.py

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
  - Feeding correct JSON → reward 1.0, exit 0.
  - Feeding wrong city → reward 0.6, exit 0.
  - Missing file → reward 0.0, exit 1.
  - ASCII "Shanghai" → dim_city=0.0.
- Depends on: Step 3

### Step 8: Write tests/test.sh

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
- Depends on: Step 7

### Step 9: Write solution/solve.sh

- Purpose: Provide oracle reference solution for CI and evaluation.
- Files: `tasks/weather-city-travel-pick/solution/solve.sh`
- Actions:
  - Enumerate cities via `/api/locations`, fetch AQI via `/api/location/{slug}/air-quality`, parse temp_high_c from HTML at `/location/{slug}`, apply filter, pick lowest AQI, write JSON.
- Acceptance check:
  - Running solve.sh → `/workspace/output/travel_pick.json` created.
  - Running verify.py after → reward 1.0.
- Depends on: Steps 4–8

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
- `allow_internet = true` in task.toml.

---

## 6. Data And State Plan

### Correct Target Data

| field | value | type | source |
|---|---|---|---|
| city | 上海 | string (Chinese) | seed.ts → shanghai.display_name |
| aqi | 35 | integer | seed.ts → shanghai.aqi |
| temp_high_c | 22 | integer | seed.ts → shanghai.today.temp_high_c |
| reason | any string | string | agent-generated, not verified |

### Distractor Cities

| city | reason eliminated | purpose |
|---|---|---|
| 北京 (AQI=75, temp=28°C) | qualifies but loses to 上海 by AQI | near-miss — forces AQI comparison |
| 深圳 (AQI=28, temp=30°C) | temp > 28°C | tests temperature upper bound; low AQI misleads |
| 成都 (AQI=120, temp=23°C) | AQI ≥ 100 | tests AQI threshold; comfortable temp misleads |
| 哈尔滨 (AQI=22, temp=12°C) | temp < 15°C | tests temperature lower bound; lowest AQI misleads |

### State Persistence

- Agent writes JSON file; verifier reads it directly.
- No database write required from agent.

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

---

## 8. Verifier And Reward Plan

### Verifier Integrity Trace

| Spec scoring dimension | Weight | Verifier file/function | State read | Failure/partial policy | Zero-work baseline result | Domain-specific assertion |
|---|---:|---|---|---|---|---|
| Dim1: city == 上海 | 0.4 | tests/verify.py `dim_city` | `/workspace/output/travel_pick.json` → `city` field (string) | missing file → 0.0 total; wrong string → dim=0.0; ASCII "Shanghai" → dim=0.0 | 0.0 (file not created) | City name must be Chinese 上海 (UTF-8), not ASCII transliteration |
| Dim2: aqi == 35 | 0.3 | tests/verify.py `dim_aqi` | same file → `aqi` field (int) | wrong value or float type → 0.0; string "35" → 0.0 | 0.0 | AQI is an integer air-quality index; exact match required |
| Dim3: temp_high_c within ±1 of 22 | 0.3 | tests/verify.py `dim_temp` | same file → `temp_high_c` field (int) | out of range [21, 23] → 0.0; non-integer → 0.0 | 0.0 | Represents today's high temperature in °C from daily forecast |

**Weight sum**: 0.4 + 0.3 + 0.3 = 1.0 ✓

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

---

## 9. Reference Solution Plan

Oracle values (hidden from instruction.md): city=上海, aqi=35, temp_high_c=22.

A production solve.sh should enumerate slugs via `/api/locations`, fetch AQI via `/api/location/{slug}/air-quality`, parse temp_high_c from HTML at `/location/{slug}`, apply filter, pick lowest AQI, write JSON.

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

- Issue: No JSON API for temperature; agent must parse HTML at /location/{slug}.
- Blocking impact: Low — HTML pages show temperature prominently.
- Suggested resolution: solve.sh oracle can use HTML parsing.

### R-02: _meta_aqi_got is integer but uses _meta_ prefix

- Issue: Spec-mandated convention; Harbor accepts integer values.
- Suggested resolution: Keep as-is per spec §6.

---

## Domain-Specific Data Trace

| Domain checklist item | Spec fact preserved | Plan-added concrete detail | Seed/fixture action | Verifier assertion |
|---|---|---|---|---|
| Plausible AQI ranges | AQI: 22, 28, 35, 75, 120 (5 cities) | Standard US AQI scale; category labels match EPA bands; realistic for Chinese cities | seed.ts defines deterministic AQI per city | Dim2: `aqi == 35` (int) |
| Plausible temperature ranges | temp_high_c: 12, 22, 23, 28, 30 (5 cities) | Realistic spring/early summer highs for Chinese cities | seed.ts defines deterministic temp_high_c per city | Dim3: `abs(temp_high_c - 22) <= 1` |
| No medical claims; task is travel comfort | "comfortable temperatures" and "good air quality" — natural travel language | AQI categories (good/moderate/unhealthy_sensitive) in API provide domain grounding | AQI category strings in seed data | seed-only, no verifier read |
| Correct target plus meaningful distractors | 5 cities; 3 eliminated by different failure modes | 深圳: low AQI=28 but temp trap; 哈尔滨: lowest AQI=22 but cold trap; 成都: AQI trap; 北京: near-miss comparison step | All 5 cities seeded in seed.ts | Dim1: `city == "上海"` |
| Chinese city display names | city must be Chinese 上海 not ASCII Shanghai | Exact UTF-8 string comparison in verifier | seed.ts: display_name = "上海" | `city == "上海"` exact UTF-8 string match |

--- Original Design Draft End ---
