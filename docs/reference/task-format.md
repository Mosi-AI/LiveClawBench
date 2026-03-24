# Harbor Task Format

This document describes the Harbor task format used by LiveClawBench and the
hybrid evaluation rubric design.

---

## Task Directory Structure

Each task follows this standardised directory layout:

```
<task_name>/
├── task.toml               # Task metadata & resource config
├── instruction.md          # Agent-facing task description
├── environment/
│   └── Dockerfile          # Build environment
├── solution/
│   └── solve.sh            # Reference solution
└── tests/
    └── test.sh             # Verification script
```

**File responsibilities:**

- `task.toml` — declares task metadata (difficulty, domain, complexity factors) and resource config (CPU, memory, timeouts)
- `instruction.md` — the task description shown to the agent, simulating a user's natural language request
- `Dockerfile` — builds the task runtime environment on top of `liveclawbench-base:latest`, including app dependency installation, database init, and startup scripts
- `solve.sh` — reference solution script used to verify task solvability (not exposed to the agent)
- `test.sh` — verification entry point; scoring files vary by task (see [Evaluation Patterns](#evaluation-patterns) below)

---

## task.toml Template

```toml
version = "1.0"

[metadata]
difficulty = "medium"          # easy | medium | hard
category = "open-world"
tags = ["e-commerce_daily_svcs", "communication_email"]

domain = "E-commerce & Daily Svcs"
domains_multi = ["E-commerce & Daily Svcs", "Communication & Email"]

# Triple-Axis Complexity Factors (0 = absent, 1 = present)
factor_a1 = 1   # A1: Cross-Service Dependency
factor_a2 = 0   # A2: Contaminated Initial State
factor_b1 = 0   # B1: Implicit Goal Resolution
factor_b2 = 0   # B2: Knowledge System Maintenance

case_id = 99    # Unique integer across all tasks (check docs/metadata/cases_registry.csv)

[verifier]
timeout_sec = 900.0

[agent]
timeout_sec = 1800.0

[environment]
build_timeout_sec = 600.0
cpus = 2
memory_mb = 4096
storage_mb = 10240
allow_internet = true   # required if the agent needs LLM API access
```

**Key fields:**

| Field | Description |
|-------|-------------|
| `case_id` | Unique integer identifier; check `docs/metadata/cases_registry.csv` before assigning |
| `domain` | Primary task domain (e.g., `E-commerce & Daily Svcs`) |
| `domains_multi` | All domains the task touches, including primary |
| `factor_a1` .. `factor_b2` | Complexity factor flags per the Triple-Axis Framework |
| `verifier.timeout_sec` | Maximum execution time for the verification script |
| `agent.timeout_sec` | Maximum time the agent has to complete the task |
| `environment.build_timeout_sec` | Docker environment build timeout |
| `allow_internet` | Set to `true` if the agent must call external LLM APIs |

**Complexity factor fields** (set to `1` when the factor applies, `0` when absent):

| Field | Factor |
|-------|--------|
| `factor_a1` | A1 — Cross-Service Dependency |
| `factor_a2` | A2 — Contaminated Initial State |
| `factor_b1` | B1 — Implicit Goal Resolution |
| `factor_b2` | B2 — Knowledge System Maintenance |

---

## Hybrid Evaluation Rubric

LiveClawBench uses an outcome-driven hybrid evaluation strategy that balances
determinism with flexibility.

**Rule-based verification (`test.sh`):**

The verification script checks environment state after task completion:

- **Database state** — query SQLite databases to verify expected records exist (orders, emails, schedules, etc.)
- **File contents** — check generated files for expected content (skill files, code, reports, etc.)
- **API responses** — call mock service APIs to verify service state matches expectations

**Outcome-driven principle:**

- The verifier checks final state, not the agent's action sequence
- Agents can achieve the goal via any strategy: direct API calls, web UI interaction, scripting, etc.
- This ensures evaluation reflects genuine agent capability rather than path memorisation

**Partial credit:**

- For multi-step tasks, the verifier decomposes the task into independent checkpoints
- Each checkpoint is scored independently; completing partial steps yields partial credit
- Example: the flight-info-change-notice task has three checkpoints — "identify change email", "find affected schedule", "send notification"
- This provides fine-grained capability measurement and avoids all-or-nothing scoring

### Evaluation Patterns

LiveClawBench tasks use one of three evaluation patterns, each suited to different verification needs:

| Pattern | Files in `tests/` | Score Source | Used By |
|---------|-------------------|-------------|---------|
| **verify.py** | `test.sh` + `verify.py` | `Score: X.X/1.0` | E-commerce, email, flight, calendar, blog, vue tasks (18) |
| **evaluate.py** | `test.sh` + `evaluate.py` + `run_benchmark.sh` [+ `reference/`] | `TOTAL SCORE: X / 100` → normalized to 0.0–1.0 | skill-* tasks (5) |
| **LLM judge** | `test.sh` + `deterministic_checks.py` + `llm_judge.py` + `answer_key.json` + `rubric.json` | Structured JSON → `reward.txt` | Research/complex tasks (6) |

All patterns ultimately write a scalar score to `/logs/verifier/reward.txt`. The `verify.py` pattern is recommended for new tasks (see [Adding Tasks](../guide/adding-tasks.md) for the full contract).

---

### `reward.json` Structure

Tasks that produce sub-dimension scores write `/logs/verifier/reward.json` alongside `reward.txt`. Two rules apply universally; everything else is task-type specific:

| Rule | Description |
|------|-------------|
| **`reward` is mandatory** | The canonical aggregate score — `float ∈ [0.0, 1.0]`, normalized weighted sum of all sub-dimensions. Harbor uses this key for dataset-level metrics. |
| **`_meta_` prefix for non-float fields** | Any string or nested-object field (rationales, model names, mode flags) must carry the `_meta_` prefix. Harbor tracks all `float \| int` keys in `reward_stats`; un-prefixed string values corrupt dataset-level aggregation. |

All other `float | int` keys are unrestricted and task-type specific (e.g. `answer_accuracy`, `contract_valid`, `db_integrity`). Harbor tracks every numeric key independently in `reward_stats`; aggregate `reward` via weights declared in `rubric.json`.

Minimal example:

```json
{
  "contract_valid":   1.0,
  "answer_accuracy":  0.75,
  "_meta_rationale":  "The agent correctly identified ...",
  "_meta_judge_model": "kimi-k2.5",
  "reward":           0.80
}
```

`reward.txt` must contain exactly the value of `reward`:

```
0.8
```
