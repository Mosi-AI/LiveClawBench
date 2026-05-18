# Implement weather-outdoor-window (case_id=111): B1 Outdoor Exercise Window Finder

## Goal Description

Create all task files for the `weather-outdoor-window` LiveClawBench benchmark task. This is a hard Health & Wellness task with B1=1 (Implicit Goal Resolution): an agent consults today's hourly weather forecast for Shanghai, must infer—without being told—what conditions make an hour suitable for outdoor running, identify the longest continuous block of qualifying hours, and persist the time window as structured JSON.

The implementation covers: registering the task in both metadata indices (task-binary-map.json and cases_registry.csv), and creating the full task directory with all six required files (task.toml, instruction.md, environment/Dockerfile, tests/verify.py, tests/test.sh, solution/solve.sh). The instruction must contain no explicit numeric thresholds (no temperature bounds, no precipitation threshold); the agent must infer that rain disqualifies hours and apply a longest-continuous-run algorithm across 24 hourly rows.

Correct answer (hidden from instruction): start_hour=0, end_hour=9, duration_hours=10. Hours 0–9 have precip=0.0; hours 10–20 have precip≈0.4 (rain); hours 21–23 have precip=0.0 again. Temperature (18–22°C) never disqualifies any hour.

## Acceptance Criteria

Following TDD philosophy, each criterion includes positive and negative tests for deterministic verification.

- AC-1: `mock-platform/config/task-binary-map.json` and `mock-platform/scripts/build-task-images.ts` are updated for `weather-outdoor-window`
  - Positive Tests (expected to PASS):
    - `jq '.tasks."weather-outdoor-window"' mock-platform/config/task-binary-map.json` returns `{"binaries":["weather"]}` (entry is under the `"tasks"` key, not top-level)
    - `"weather-outdoor-window"` appears in `ALL_TASK_NAMES` set in `mock-platform/scripts/build-task-images.ts`
    - Running `bun run build:images` from mock-platform/ builds a `liveclawbench-weather-outdoor-window-base:latest` image successfully
  - Negative Tests (expected to FAIL):
    - Adding entry at the top level (not under `"tasks"`) causes the build script to not find the task mapping
    - Omitting the task from `ALL_TASK_NAMES` causes `build-task-images.ts` schema validation to fail

- AC-2: Both registry CSVs and `complexity-framework.md` contain the `weather-outdoor-window` entry
  - Positive Tests (expected to PASS):
    - `grep "^111," docs/metadata/cases_registry.csv` returns exactly one line with all correct fields
    - `grep "^111," docs/metadata/cases_registry_zh.csv` returns exactly one line
    - `grep "weather-outdoor-window" docs/en/reference/complexity-framework.md` returns a table row with `H`, `✓` in B1 column, `Health & Wellness` domain
    - `python scripts/validate_annotations.py` exits 0 after all three sources are updated
  - Negative Tests (expected to FAIL):
    - Adding only to `cases_registry.csv` but not `cases_registry_zh.csv` causes `validate_annotations.py` to report missing entry in `cases_registry_zh`
    - Adding CSV rows but not updating `complexity-framework.md` causes `[toml↔framework]` error once task.toml is created

- AC-3: `tasks/weather-outdoor-window/task.toml` is valid and matches spec metadata exactly
  - Positive Tests (expected to PASS):
    - `python scripts/validate_tasks.py` exits 0 for this task with no errors
    - File contains `case_id = 111`, `difficulty = "hard"`, `factor_b1 = 1`, `allow_internet = true`
    - `python scripts/validate_annotations.py` exits 0 after both AC-2 and AC-3 are satisfied
  - Negative Tests (expected to FAIL):
    - Setting `factor_b1 = 0` causes `validate_annotations.py` to report annotation mismatch
    - Adding deprecated `capability_dimension` field causes `validate_tasks.py` to flag an error
    - Missing `allow_internet = true` would cause runtime LLM API failure for the agent

- AC-4: `tasks/weather-outdoor-window/instruction.md` is B1=1 compliant
  - Positive Tests (expected to PASS):
    - File contains the exact spec §3 instruction text verbatim
    - `grep -c "localhost:3000/location/shanghai/hourly" tasks/weather-outdoor-window/instruction.md` returns 1
    - File contains no explicit temperature or precipitation threshold values
  - Negative Tests (expected to FAIL):
    - File containing "temperature is between 10°C and 28°C" would violate B1=1 by leaking thresholds
    - File containing "precip_mm = 0" would violate B1=1 by specifying the rain threshold
    - File containing "start_hour=0" or "end_hour=9" would leak the oracle answer

- AC-5: `tasks/weather-outdoor-window/environment/Dockerfile` uses the correct per-task base image
  - Positive Tests (expected to PASS):
    - File contains exactly `FROM liveclawbench-weather-outdoor-window-base:latest` as the only instruction
    - `docker build -t liveclawbench-weather-outdoor-window tasks/weather-outdoor-window/environment/` succeeds (requires base image from AC-1)
  - Negative Tests (expected to FAIL):
    - Using `FROM liveclawbench-base:latest` (wrong base) omits the weather binary and startup script
    - Using `FROM liveclawbench-weather-city-travel-pick-base:latest` (wrong task base) would fail

- AC-6: `tasks/weather-outdoor-window/tests/verify.py` correctly implements the 3-dimension reward function
  - Positive Tests (expected to PASS):
    - Feeding `{"start_hour":0,"end_hour":9,"duration_hours":10}` → reward=1.0, exit 0
    - Feeding `{"start_hour":0,"end_hour":9,"duration_hours":5}` → reward=0.8 (dim_start+dim_end), exit 0
    - Missing file → reward=0.0, exit 1, reward.txt contains "0.0"
    - `reward.json` contains `"reward"`, `"dim_start"`, `"dim_end"`, `"dim_duration"`, `"start_got"`, `"end_got"`, `"duration_got"` — all numeric
    - `reward.json` values for `start_got`, `end_got`, `duration_got` are integers (not strings, not floats)
  - Negative Tests (expected to FAIL):
    - Feeding `{"start_hour":0.0,"end_hour":9,"duration_hours":10}` → dim_start=0.0 (float not int)
    - Feeding `{"start_hour":1,"end_hour":9,"duration_hours":9}` → dim_start=0.0 (wrong start; Block B misidentified as winner)
    - Feeding `{"start_hour":21,"end_hour":23,"duration_hours":3}` → reward=0.0 (found shorter window instead of longest)
    - Missing file → exits 1 (blocks harbor from recording a passing score)
  - AC-6.1: `reward.json` uses no `_meta_` prefix (all fields are integers — harbor accepts int values directly)
    - Positive: All keys in reward.json (`dim_start`, `dim_end`, `dim_duration`, `start_got`, `end_got`, `duration_got`) parse as numeric in JSON
    - Negative: Using `"_meta_start_got": "0"` would be a string value, violating harbor's `dict[str, float|int]` model
  - AC-6.2: verify.py uses `type(x) is int` (not `isinstance(x, int)`) for all three dimension guards
    - Positive: `type(0) is int` → True; `type(9) is int` → True; `type(10) is int` → True (correct oracle values pass)
    - Negative: `isinstance(False, int)` → True but `type(False) is int` → False; so `{"start_hour": false}` (JSON boolean) does NOT falsely score as dim_start=0.4 when `type()` guard is used. This matters because start_hour=0 and Python `False == 0` would be True under `isinstance`.

- AC-7: `tasks/weather-outdoor-window/tests/test.sh` correctly invokes the verifier and propagates its exit code
  - Positive Tests (expected to PASS):
    - Script has `#!/usr/bin/env bash` shebang and `set -e`
    - Script calls `python3 /tests/verify.py` (container path, not `/workspace/tests/`)
    - Script creates `/logs/verifier/` before verify.py runs
  - Negative Tests (expected to FAIL):
    - Calling `python3 /workspace/tests/verify.py` (wrong path) would fail inside container
    - Suppressing verify.py exit code would hide verifier failures from harbor

- AC-8: `tasks/weather-outdoor-window/solution/solve.sh` produces a reward=1.0 when run and verified
  - Positive Tests (expected to PASS):
    - Running solve.sh creates `/workspace/output/exercise_window.json` with `start_hour=0` (int), `end_hour=9` (int), `duration_hours=10` (int)
    - Running verify.py after solve.sh → reward=1.0, exit 0
  - Negative Tests (expected to FAIL):
    - A solution that picks `start_hour=21, end_hour=23` (shorter window) → reward=0.0
    - Writing float values (e.g. `"start_hour": 0.0`) → dim_start=0.0 (integer type guard fails)

## Path Boundaries

Path boundaries define the acceptable range of implementation quality and choices.

### Upper Bound (Maximum Acceptable Scope)
The implementation creates all nine artifacts exactly as specified in the draft: task-binary-map.json entry, cases_registry.csv row, full task directory with task.toml, instruction.md, environment/Dockerfile, tests/verify.py (with integer type guards and all-numeric reward.json), tests/test.sh, and solution/solve.sh that parses the live hourly HTML and applies a longest-continuous-block algorithm. All tooling validations pass.

### Lower Bound (Minimum Acceptable Scope)
The implementation creates all nine artifacts exactly as specified in the draft. The lower bound is identical to the upper bound.

> **Deterministic Design**: This plan specifies a fully deterministic implementation. All file contents, expected values, type requirements, and API conventions are fixed by the audited spec. The upper and lower bounds converge to a single point. There are no implementation choices to make.

### Allowed Choices
- **Fixed per spec**: All file contents, expected values (`start_hour=0`, `end_hour=9`, `duration_hours=10`), integer type convention, all-numeric reward.json (no `_meta_` prefix)
- Can use: any HTML parsing approach in solve.sh (grep, python3 html.parser, etc.) that correctly extracts the 24 today-rows from `/location/shanghai/hourly` and identifies the 降水(mm) column
- Cannot use: explicit temperature or precipitation thresholds in instruction.md, non-integer JSON values for any of the three output fields, hardcoded answer values in solve.sh

## Feasibility Hints and Suggestions

> **Note**: This section is for reference and understanding only. These are conceptual suggestions, not prescriptive requirements.

### Conceptual Approach

**solve.sh approach** (one viable path using curl + python3):
```bash
#!/usr/bin/env bash
set -e
# Fetch hourly page
HTML=$(curl -s "http://localhost:3000/location/shanghai/hourly")
# Parse 24 today-rows; extract hour and precip_mm
# Hours where precip_mm == "0.0" qualify
# Find longest consecutive qualifying block
# Write {"start_hour":0,"end_hour":9,"duration_hours":10}
python3 - <<'PYEOF'
import re, json
# parse HTML for today rows; extract 時間 and 降水(mm) columns
# run max-consecutive-zeros scan
# output JSON
PYEOF
```

**Longest-continuous-block scan** (pseudocode):
```
best_start, best_len = 0, 0
cur_start, cur_len = None, 0
for hour, qualifies in hourly_data:
    if qualifies:
        if cur_len == 0: cur_start = hour
        cur_len += 1
        if cur_len > best_len:
            best_start, best_len = cur_start, cur_len
    else:
        cur_len = 0
start_hour = best_start
end_hour = best_start + best_len - 1
duration_hours = best_len
```

**verify.py integer guard**:
```python
dim_start = 0.4 if isinstance(start_hour, int) and start_hour == 0 else 0.0
# Note: bool is int subclass but json.load never returns bool for numeric JSON values
```

### Relevant References
- `mock-platform/mocks/weather/src/index.tsx` — `/location/:slug/hourly` route; renders 时间, 温度, 降水(mm) columns
- `mock-platform/mocks/weather/src/seed.ts` — Shanghai seed: temp_high=22, temp_low=18, daily_precip=4; precip distributed over hours 10–20
- `tasks/weather-city-travel-pick/` — sibling task for reference on file structure and verify.py patterns
- `mock-platform/config/task-binary-map.json` — existing entries to match JSON format

## Dependencies and Sequence

### Milestones

1. **Metadata Registration**: Register the task in both global metadata indices
   - Register `weather-outdoor-window` in task-binary-map.json (enables base image build)
   - Append `case_id=111` row to cases_registry.csv (enables validate_annotations.py)

2. **Task Directory Build**: Create the task directory and all six required files
   - Create directory skeleton (`tasks/weather-outdoor-window/` with `environment/`, `solution/`, `tests/`)
   - Write task.toml from spec §1 verbatim
   - Write instruction.md from spec §3 verbatim (B1-compliant, no thresholds)
   - Write environment/Dockerfile (single FROM line)
   - Write tests/verify.py (3-dim reward function, all-numeric reward.json)
   - Write tests/test.sh (verifier runner)
   - Write solution/solve.sh (oracle: parse HTML, run longest-block algorithm)

3. **Validation**: Confirm all tooling and reward logic is correct
   - `python scripts/validate_tasks.py` passes
   - `python scripts/validate_annotations.py` passes
   - Zero-work reward check: verify.py without agent file → reward=0.0
   - Oracle check: solve.sh → verify.py → reward=1.0

Milestone 2 depends on Milestone 1 (Dockerfile depends on base image name from task-binary-map.json).

## Task Breakdown

Each task must include exactly one routing tag:
- `coding`: implemented by Claude
- `analyze`: executed via Codex (`/humanize:ask-codex`)

| Task ID | Description | Target AC | Tag | Depends On |
|---------|-------------|-----------|-----|------------|
| task1 | Add `"weather-outdoor-window": {"binaries": ["weather"]}` under `"tasks"` key in mock-platform/config/task-binary-map.json | AC-1 | coding | - |
| task1b | Add `"weather-outdoor-window"` to `ALL_TASK_NAMES` set in mock-platform/scripts/build-task-images.ts | AC-1 | coding | - |
| task2 | Append case_id=111 row to docs/metadata/cases_registry.csv | AC-2 | coding | - |
| task2b | Append case_id=111 row to docs/metadata/cases_registry_zh.csv | AC-2 | coding | - |
| task2c | Add case_id=111 row to complexity-framework.md annotation table (B1=✓, H, Health & Wellness) | AC-2 | coding | - |
| task3 | Create tasks/weather-outdoor-window/ directory skeleton (environment/, solution/, tests/) | AC-3..AC-8 | coding | - |
| task4 | Write tasks/weather-outdoor-window/task.toml | AC-3 | coding | task3 |
| task5 | Write tasks/weather-outdoor-window/instruction.md | AC-4 | coding | task3 |
| task6 | Write tasks/weather-outdoor-window/environment/Dockerfile | AC-5 | coding | task1, task3 |
| task7 | Write tasks/weather-outdoor-window/tests/verify.py (use `type(x) is int` for all dim guards) | AC-6, AC-6.1, AC-6.2 | coding | task3 |
| task8 | Write tasks/weather-outdoor-window/tests/test.sh | AC-7 | coding | task7 |
| task9 | Write tasks/weather-outdoor-window/solution/solve.sh | AC-8 | coding | task4, task5, task6, task7, task8 |

## Claude-Codex Deliberation

### Agreements
- The implementation plan is fully deterministic: all file contents, expected values, and type conventions are fixed by the audited spec (Stage 2 plan-creation-audit PASS in round 1, no fixes needed)
- B1=1 compliance is non-negotiable: instruction.md must contain no explicit thresholds (temperature bounds, precipitation == 0)
- All reward.json diagnostic fields (`start_got`, `end_got`, `duration_got`) are integers — no `_meta_` prefix needed, unlike weather-city-travel-pick which uses `_meta_` for its string city field
- `type(x) is int` is required (not `isinstance(x, int)`) because start_hour=0 and `isinstance(False, int) and False == 0` is True — would falsely award dim_start credit for JSON boolean false
- The hourly page shows 24 today-rows + 6 tomorrow-rows; solve.sh must use only today's rows
- Precipitation threshold heuristic for solve.sh: any non-"0.0" precip value should be treated as rain (no need for exact float comparison)
- task-binary-map.json entries belong under the `"tasks"` key (confirmed from actual file schema)
- `build-task-images.ts` `ALL_TASK_NAMES` set must include the new task name (confirmed from actual file)
- Both `cases_registry.csv` AND `cases_registry_zh.csv` must be updated (confirmed from validate_annotations.py source)
- `complexity-framework.md` must include the new task row (confirmed from validate_annotations.py `[toml↔framework]` check)

### Resolved Disagreements
- **task-binary-map.json, build-task-images.ts, cases_registry_zh.csv, complexity-framework.md gaps**: All four gaps were confirmed by reading actual source files. Resolved by adding tasks 1b, 2b, 2c to Task Breakdown.
- **bool/int type guard**: `type(x) is int` replaces `isinstance(x, int)` for all three dim guards to prevent false credit for JSON boolean values where oracle is 0 (start_hour).

### Convergence Status
- Final Status: `converged` (all material technical gaps confirmed and incorporated; bool/int fix applied to verify.py spec; no pending user decisions)

## Pending User Decisions

No pending user decisions. All design parameters are fully specified by the audited Stage 2 plan and require no user input.

## Implementation Notes

### Code Style Requirements
- Implementation code and comments must NOT contain plan-specific terminology such as "AC-", "Milestone", "Step", "Phase", or similar workflow markers
- These terms are for plan documentation only, not for the resulting codebase
- Use descriptive, domain-appropriate naming in code instead
- verify.py must use Python standard library only (json, os, sys) — no third-party imports
- solve.sh may use bash, curl, and python3 (all available in the container) — no additional dependencies
- The hourly HTML parsing in solve.sh should handle the 24-row today boundary robustly (do not assume row count equals exactly 24 — check date headers if available)

--- Original Design Draft Start ---

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

--- Original Design Draft End ---
