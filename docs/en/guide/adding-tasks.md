# Adding Tasks

This guide explains how to create a new benchmark task for LiveClawBench and submit it via pull request.

## Task Directory Structure

Create a directory under `tasks/<task-name>/` with the following layout:

```
tasks/<task-name>/
├── task.toml           # Required: metadata, timeouts, resource limits
├── instruction.md      # Required: agent-facing task description
├── environment/
│   └── Dockerfile      # Required: container build definition
├── solution/
│   └── solve.sh        # Oracle baseline: proves solvability + validates verifier logic
│                       # Run with --agent oracle; NOT executed during normal evaluation
└── tests/
    ├── test.sh         # Required: verification entry point (Harbor uploads this at runtime)
    └── verify.py       # Required: scoring logic
```

Naming: use `kebab-case` derived from the task's logical name (e.g., `flight-seat-selection`).

## Execution Lifecycle

Understanding when each task file runs helps you write correct Dockerfiles, startup scripts, and verifiers.

```
Stage 1  Container Build    Dockerfile → image (environment/Dockerfile)
Stage 2  Env Init           /entrypoint.sh → startup.sh (background) → sleep 5s → services ready
Stage 3  Agent Setup        Harbor writes LLM provider config to ~/.openclaw/openclaw.json
Stage 4  Task Execution     openclaw agent --session-id harbor --message "<instruction.md content>"
Stage 5  Verifier Init      Harbor uploads tests/ into container, creates /logs/verifier/
Stage 6  Verification       bash /tests/test.sh → verify.py → writes reward.json + reward.txt
Stage 7  Result Collection  Harbor reads /logs/verifier/reward.txt, saves result.json
Stage 8  Cleanup            Container stopped and removed
```

File mapping:
- **Stage 1** → `environment/Dockerfile`
- **Stage 2** → `environment/entrypoint.sh` + `environment/startup.sh`
- **Stage 3** → Harbor OpenClaw adapter (automatic)
- **Stage 4** → agent reads `instruction.md` content
- **Stage 5–6** → `tests/test.sh` + `tests/verify.py`
- **`solution/solve.sh`** → only Stage 4 when `--agent oracle` is used; never runs in normal evaluation

> **Important:** The `tests/` directory is uploaded by Harbor at runtime — it is **not** baked into the container image. Do not rely on `tests/` being present during `docker build`.

## `task.toml` Field Reference

```toml
version = "1.0"

[metadata]
difficulty = "medium"          # easy | medium | hard
category = "open-world"
tags = ["e-commerce_daily_svcs", "communication_email"]

domain = "E-commerce & Daily Svcs"
domains_multi = ["E-commerce & Daily Svcs", "Communication & Email"]

# Triple-Axis Complexity Factors (0 = absent, 1 = present)
factor_a1 = 1   # A1: Cross-Service Dependency — task spans multiple services/APIs
factor_a2 = 0   # A2: Contaminated Initial State — pre-existing noise the agent must resolve
factor_b1 = 0   # B1: Implicit Goal Resolution — goal is underspecified; agent must infer intent
factor_b2 = 0   # B2: Knowledge System Maintenance — agent must persist or update structured knowledge

case_id = 99    # Unique integer across all tasks (check ../../metadata/cases_registry.csv)

[verifier]
timeout_sec = 900.0    # Max time for verify.py to run after the agent finishes

[agent]
timeout_sec = 1800.0   # Max time for the agent to complete the task

[environment]
build_timeout_sec = 600.0
cpus = 2
memory_mb = 4096
storage_mb = 10240
allow_internet = true  # REQUIRED for all OpenClaw tasks (agent calls LLM APIs)
```

> **Critical:** `allow_internet = true` is mandatory for any task where the agent uses its own LLM APIs inside the container (which is all OpenClaw tasks).

## Dockerfile Requirements

All task Dockerfiles inherit from `liveclawbench-base:latest`, which pre-bakes the HTTPS apt source fix, `python3 python3-pip python3-venv curl`, Playwright Chromium at `/usr/bin/chromium`, and `/workspace/output`. **Build it once before building any task image:**

```bash
docker build -t liveclawbench-base:latest docker/base/
```

There are four patterns in use across the 30 tasks — pick the one that matches your task type:

### Pattern 1: Static file drop (skill-\*, blog-site-\*, vue-project-\*)

No background services. The agent reads/writes files under `/workspace/environment/` directly. No `ENTRYPOINT` needed.

```dockerfile
FROM liveclawbench-base:latest

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true
USER root

# Install task-specific tools only (python3/pip/venv/curl already in base)
RUN apt-get update && apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

COPY . /workspace/environment/
```

### Pattern 2: Python backend service (shop-app series)

Single Python backend; `startup.sh` lives at `/workspace/environment/startup.sh`.

```dockerfile
FROM liveclawbench-base:latest

COPY . /workspace/environment/
# --no-cache-dir: reduce image layer size
# --break-system-packages: required on Debian Bookworm (PEP 668) — system Python is marked
#   "externally managed", so plain pip install fails without this flag
RUN cd /workspace/environment/shop-app/backend && pip install --no-cache-dir --break-system-packages -r requirements.txt

COPY startup.sh /workspace/environment/startup.sh
RUN chmod +x /workspace/environment/startup.sh

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "sleep infinity"]
```

### Pattern 3: Full-stack service (airline-app / email-app series)

Python backend + Node.js frontend; `startup.sh` lives at `/workspace/startup.sh`.

```dockerfile
FROM liveclawbench-base:latest

COPY . /workspace/environment/
# --no-cache-dir: reduce image layer size
# --break-system-packages: required on Debian Bookworm (PEP 668)
RUN cd /workspace/environment/your-app/backend && pip install --no-cache-dir --break-system-packages -r requirements.txt
RUN cd /workspace/environment/your-app/frontend && npm install

COPY startup.sh /workspace/startup.sh
RUN chmod +x /workspace/startup.sh

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "sleep infinity"]
```

### Pattern 4: ARG override (knowledge / research tasks)

Working directory is `/home/node/.openclaw/`; runs as `node` user; `ARG OPENCLAW_BASE_IMAGE` lets Harbor substitute the base image at runtime.

```dockerfile
ARG OPENCLAW_BASE_IMAGE=liveclawbench-base:latest
FROM ${OPENCLAW_BASE_IMAGE}

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

ENV HOME=/home/node \
    OPENCLAW_ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/coding/v3 \
    OPENCLAW_ARK_MODEL=kimi-k2.5
WORKDIR /home/node/.openclaw

USER root
RUN mkdir -p /home/node/.openclaw/output /home/node/.openclaw/workspace/memory \
             /home/node/.openclaw/tests /home/node/.openclaw/tools /home/node/.openclaw/solution \
    && chown -R node:node /home/node

COPY corpus/ /home/node/.openclaw/corpus/
COPY workspace_seed/ /home/node/.openclaw/workspace/

USER node
```

- Services are accessible to the agent at `localhost:<port>`

## `verify.py` Contract

### Output format

Harbor supports two parallel output files written by `test.sh`:

| File | Format | Role |
|------|--------|------|
| `/logs/verifier/reward.txt` | Plain scalar | Required; Harbor reads this for the final score |
| `/logs/verifier/reward.json` | Structured JSON | Recommended; sub-dimension scores and metadata for post-hoc analysis |

**Recommended pattern: dual-write.** Write both files. `reward.txt` is the authoritative scalar; `reward.json` preserves per-dimension breakdown for analysis. Harbor reads `reward.txt` first; `reward.json` is used as fallback only when `reward.txt` is absent.

`reward.json` schema — two hard rules, everything else is task-type specific:

```json
{
  "dimension_a": 0.75,
  "dimension_b": 1.0,
  "_meta_rationale": "The agent correctly identified ...",
  "_meta_judge_model": "kimi-k2.5",
  "reward": 0.875
}
```

**`reward.json` rules:**

1. **`reward` is mandatory** — the canonical aggregate score, `float ∈ [0.0, 1.0]`, normalized weighted sum of all sub-dimensions. This is the key Harbor uses for dataset-level metrics.
2. **`_meta_` prefix for non-float fields** — any string or nested-object field (rationales, model names, mode flags) must use the `_meta_` prefix. Harbor's `VerifierResult` model enforces `rewards: dict[str, float | int]`; an un-prefixed string value causes a Pydantic `ValidationError` when harbor reads `reward.json` as the sole reward file, aborting the trial with an exception. (When dual-writing, harbor reads `reward.txt` and never parses `reward.json`, so the constraint only matters for json-only tasks — but the prefix is good hygiene regardless.)
3. **Other `float | int` keys are task-type specific** — sub-dimension scores (e.g. `answer_accuracy`, `contract_valid`, `db_integrity`) are unrestricted. All numeric keys are tracked independently in `reward_stats`; derive `reward` from them via `rubric.json` weights.

`reward.txt` contains only the `reward` value:

```
0.875
```

### Contracts

`verify.py` **must**:
1. Print a line matching `Score: X.X/1.0` (e.g. `Score: 1.0/1.0` or `Score: 0.5/1.0`)
2. Exit with code `0` if the score is ≥ 0.5 (pass threshold)
3. Exit with a non-zero code if the score is < 0.5

`test.sh` **must**:
1. Call `verify.py` (or equivalent scoring logic)
2. Write the scalar score to `/logs/verifier/reward.txt`
3. For tasks with sub-dimension scoring, also write `/logs/verifier/reward.json` following the rules above

Scoring convention:
- `1.0` — task fully completed
- `0.5` — meaningful progress (partial credit)
- `0.0` — task failed

### Minimal verify.py example

```python
#!/usr/bin/env python3
"""Task verification script."""

def evaluate() -> float:
    # ... scoring logic ...
    return score

if __name__ == "__main__":
    score = evaluate()
    print(f"Score: {score:.1f}/1.0")
    import sys
    sys.exit(0 if score >= 0.5 else 1)
```

### Dual-write test.sh example

```bash
#!/usr/bin/env bash
set -euo pipefail
mkdir -p /logs/verifier

SCORE=$(python3 /tests/verify.py 2>&1 | grep -oP 'Score:\s*\K[0-9.]+' | tail -1)
echo "$SCORE" > /logs/verifier/reward.txt

# Optional: write structured JSON for sub-dimension analysis
python3 -c "
import json
score = float('$SCORE')
result = {'reward': score}
json.dump(result, open('/logs/verifier/reward.json', 'w'), indent=2)
"
echo "Verification score: $SCORE"
```

## `solve.sh` — Oracle Baseline

`solution/solve.sh` has two purposes:

1. **Validates task solvability** — proves the task is solvable and that your `verify.py` logic is correct. Run it during task development to confirm `verify.py` gives a full score (1.0) on a working solution.
2. **Provides a reference solution** — used when running the oracle agent to establish a baseline score. The gap between oracle score and agent score quantifies difficulty.

`solve.sh` is **only executed** when `--agent oracle` is passed to `harbor run`. It does not run during normal evaluation with `-a openclaw`.

```bash
# Run oracle agent to validate your task and establish a baseline
harbor run -p tasks/<task-name> --agent oracle -n 1 -o jobs
```

## Validating Before Submission

Run the task validator to catch structural issues:

```bash
python scripts/validate_tasks.py
```

The validator checks:
- All required files are present
- Directory name matches `kebab-case` pattern
- `task.toml` has required fields (`version`, `difficulty`, `case_id`, `domain`, `allow_internet`)
- `case_id` is unique across all tasks
- Stub warnings: short `instruction.md`, echo-only `test.sh`, missing `solve.sh`

All 30 existing tasks must continue to pass.

## Submission Checklist

1. Create `tasks/<task-name>/` with all required files
2. Set `allow_internet = true` in `task.toml` under `[environment]`
3. Assign a unique `case_id` (check `../../metadata/cases_registry.csv`)
4. Add an entry to `registry.json`
5. Add a row to `../../metadata/cases_registry.csv`
6. Run `python scripts/validate_tasks.py` — all tasks must pass
7. Fork the repo and create a branch: `task/<task-name>`
8. Open a pull request with a brief description of the task

## Known Pitfalls

**Service startup race conditions**
If your Dockerfile starts background services, add a `sleep` in the entrypoint before signaling readiness. The standard pattern is a 5-second sleep in `startup.sh` before the agent begins.

**case_id conflicts**
Always check `../../metadata/cases_registry.csv` before choosing a `case_id`. The validator will catch duplicates, but resolving conflicts after the fact is disruptive.

**Entrypoint is not required for static tasks**
Only tasks that run background services (web servers, databases) need `startup.sh`, `entrypoint.sh`, `ENTRYPOINT`, and `CMD`. Static file tasks (skill-*, blog-site-*, vue-project-*) have none of these — the agent accesses `/workspace/environment/` directly. Adding unnecessary entrypoint boilerplate to a static task does not break anything but wastes build time and confuses readers.

**Agent file path resolution: workspace-relative vs absolute (Pattern 4 tasks)**

For Pattern 4 tasks (knowledge/research tasks running under `/home/node`), OpenClaw resolves the agent's workspace root as:

```
$HOME/.openclaw/workspace/         # default
$HOME/.openclaw/workspace-${OPENCLAW_PROFILE}/   # if OPENCLAW_PROFILE is set
```

This means a bare path like `output/result.json` in `instruction.md` is interpreted by the agent as `$HOME/.openclaw/workspace/output/result.json`, **not** `$HOME/.openclaw/output/result.json`. These are different directories.

**Task design decision:** two approaches are valid, pick one consistently:

- **Option A — Verifier adapts**: keep `instruction.md` natural (e.g. `output/result.json`), and have the verifier (`deterministic_checks.py` / `llm_judge.py`) check both candidate paths:
  ```python
  candidates = [
      Path.home() / ".openclaw/output/result.json",
      Path.home() / ".openclaw/workspace/output/result.json",
  ]
  result_path = next((p for p in candidates if p.exists()), None)
  ```
  This is more user-friendly and forgiving — preferred for new tasks.

- **Option B — Explicit path in instruction**: use the full absolute path in `instruction.md` (`/home/node/.openclaw/output/result.json`). Removes ambiguity but is verbose and leaks container internals into the task description.

The existing PKB tasks currently use Option B. New tasks should prefer Option A — letting the verifier handle both locations so the instruction stays readable.
