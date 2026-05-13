# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LiveClawBench** is a benchmark suite for evaluating LLM agents on complex, real-world assistant
tasks. The core scientific question: how does agent capability degrade when tasks stack multiple
complexity factors along three axes (Environment Complexity, Cognitive Demand, Runtime Adaptability)?

### Three-Repo Architecture

| Repository | Role | URL |
|---|---|---|
| **LiveClawBench** (this repo) | Task corpus — 30 harbor-format benchmark tasks | — |
| **claw-harbor** | Evaluation framework (fork of harbor with OpenClaw support) | https://github.com/Mosi-AI/claw-harbor |
| **OpenClaw** | Agent platform running inside task containers | https://github.com/openclaw/openclaw |

The agent under evaluation is **OpenClaw**. Harbor orchestrates Docker containers, launches the
OpenClaw agent inside each container, and verifies the result. LiveClawBench provides the tasks.

## Local Worktrees

When creating additional Git worktrees for agent-driven branch work, place them under
`./.worktrees/<branch-name>` at the repository root.

- Do not create worktrees under `./.claude/`
- Keep `./.claude/` for Claude-specific local settings/session data only
- Treat `./.worktrees/` as disposable local workspace state and keep it untracked

## Setup

### Quick Setup (recommended)

```bash
# From the LiveClawBench/ directory:
./setup.sh
```

`setup.sh` will:
1. Check prerequisites (git, uv, Docker, Python ≥ 3.12, Bun)
2. Create a local `.venv` and install `harbor` from the claw-harbor GitHub URL
3. Build the shared `liveclawbench-base:latest` Docker image
4. Build Bun mock binaries and per-task Docker images
5. Copy `.env.example` → `.env` for API key configuration

Then activate the venv before running any `harbor` commands:

```bash
source .venv/bin/activate
```

### Manual Setup

```bash
uv venv .venv
source .venv/bin/activate
uv pip install "harbor @ git+https://github.com/Mosi-AI/claw-harbor.git@v0.1.0"
```

### API Key Configuration

Edit `.env` and uncomment the block for your provider. Agent credentials are injected at runtime via `--ae`:

| Provider | Model format | Key env var |
|---|---|---|
| VolcEngine | `volcengine/` or `volcengine-plan/<model-id>` | `VOLCANO_ENGINE_API_KEY` |
| Anthropic | `anthropic/<model-id>` | `ANTHROPIC_API_KEY` |
| OpenAI | `openai/<model-id>` | `OPENAI_API_KEY` |
| Gemini | `gemini/<model-id>` | `GEMINI_API_KEY` |
| Any OpenAI-compatible | `custom/<model-id>` | `CUSTOM_API_KEY` + `CUSTOM_BASE_URL` (+ optional `CUSTOM_CONTEXT_WINDOW` / `CUSTOM_MAX_TOKENS` / `CUSTOM_REASONING` / `CUSTOM_API`) |

## Running Tasks

### Single Task

```bash
# Activate venv first (or prefix with .venv/bin/harbor)
source .venv/bin/activate

# Generic form — works with any OpenAI-compatible endpoint
harbor run -p tasks/<task-name> -a openclaw \
  -m custom/<YOUR_MODEL_ID> \
  -n 1 -o jobs \
  --ae CUSTOM_BASE_URL="<YOUR_BASE_URL>" \
  --ae CUSTOM_API_KEY="<YOUR_API_KEY>" \
  --timeout-multiplier 2.0 --debug

# Example: VolcEngine (explicitly registered in the openclaw adapter)
harbor run -p tasks/watch-shop -a openclaw \
  -m volcengine-plan/kimi-k2.5 \
  -n 1 -o jobs \
  --ae VOLCANO_ENGINE_API_KEY="$VOLCANO_ENGINE_API_KEY" \
  --debug
```

### Full Dataset

```bash
# Generic form (includes LLM judge credentials for the 5 judge tasks)
harbor run --dataset liveclawbench@0.1.0 -a openclaw \
  -m custom/<YOUR_MODEL_ID> \
  --n-concurrent 4 \
  -o jobs \
  --ae CUSTOM_BASE_URL="<YOUR_BASE_URL>" \
  --ae CUSTOM_API_KEY="<YOUR_API_KEY>" \
  --ee JUDGE_BASE_URL="<JUDGE_BASE_URL>" \
  --ee JUDGE_API_KEY="<JUDGE_API_KEY>"

# Example: Anthropic
harbor run --dataset liveclawbench@0.1.0 -a openclaw \
  -m anthropic/claude-opus-4-1 \
  --n-concurrent 4 \
  --ae ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  --ee JUDGE_BASE_URL="<JUDGE_BASE_URL>" \
  --ee JUDGE_API_KEY="<JUDGE_API_KEY>"
```

### Check Results

```bash
cat jobs/*/*/verifier/reward.txt   # 1.0 = solved, 0.5 = partial credit
```

### Common Flags

| Flag | Purpose |
|---|---|
| `-p tasks/<name>` | Run a specific task directory |
| `-a openclaw` | Use OpenClaw as the agent |
| `-m <provider>/<model>` | Model to evaluate |
| `-n <int>` | Number of attempts per task |
| `-o jobs` | Output directory for job results |
| `--ae KEY=VALUE` | Pass environment variable into the **agent process** only (via `openclaw.json`); repeatable |
| `--ee KEY=VALUE` | Pass environment variable into the **container environment** (agent + verifier both see it); repeatable |
| `--timeout-multiplier 2.0` | Scale all `task.toml` timeouts (useful for hard tasks) |
| `--debug` | Verbose logging |
| `--n-concurrent <int>` | Parallel task execution |

> **LLM-judge tasks** (5 tasks: `conflict-repair-acb`, `incremental-update-ctp`,
> `live-web-research-sqlite-fts5`, `mixed-tool-memory`, `noise-filtering`) use `--ee` (not `--ae`)
> for judge credentials because `llm_judge.py` runs in the verifier phase, outside the OpenClaw
> agent process. **Missing `--ee` will cause the verifier to fail with
> `RuntimeError: JUDGE_BASE_URL is not set`.**
>
> Required vars: `JUDGE_BASE_URL`, `JUDGE_API_KEY`;
> optional: `JUDGE_MODEL_ID` (default `deepseek-v3.2`).
> How to identify: if `tests/test.sh` calls `python3 /tests/llm_judge.py`, the task needs judge credentials.
> See [`docs/en/guide/running-tasks.md`](docs/en/guide/running-tasks.md#llm-judge-tasks) for the full example.

## Mock Platform

The `mock-platform/` directory contains Bun+Hono mock services that compile to standalone binaries via `bun build --compile`. All five services (shop, doc-search, airline, email, todolist) use Zod schema-first routes with auto-generated OpenAPI 3.1 specs.

### Build Commands

```bash
cd mock-platform

bun run build          # Build all mock binaries → dist/
bun run build:images   # Build per-task Docker images (requires base image first)
```

### Documentation

- [`mock-platform/README.md`](mock-platform/README.md) — Architecture overview, build flow, and adding-a-mock checklist
- [`mock-platform/docs/mock-conventions.md`](mock-platform/docs/mock-conventions.md) — Full conventions: factory pattern, response wrappers, auth, DB/seeding, testing
- [`mock-platform/DESIGN.md`](mock-platform/DESIGN.md) — MockAppV2 interface, file size guidelines, build pipeline, Docker layers

### Key Files

| File | Purpose |
|---|---|
| `mock-platform/README.md` | Architecture overview, build flow, and adding-a-mock checklist |
| `mock-platform/docs/mock-conventions.md` | Full conventions: factory pattern, response wrappers, auth, DB/seeding, testing |
| `mock-platform/packages/mock-lib/README.md` | Shared library API reference |
| `mocks/shop/src/index.tsx` | Shop UI and API (Hono TSX rendering) |
| `mocks/shop/src/search-algorithm.ts` | Extracted search logic (single source of truth) |
| `mocks/shop/tests/search-algorithm.test.ts` | Layer 1 unit tests (bun:test explicit assertions) |
| `mocks/doc-search/src/index.ts` | Doc-search with FTS5 + JSONL browser trace logging |

## Task List

| Task Dir | Domain | Difficulty | Verifier |
|---|---|---|---|
| `watch-shop` | E-commerce & Daily Svcs | easy | verify.py |
| `washer-shop` | E-commerce & Daily Svcs | easy | verify.py |
| `info-change` | E-commerce & Daily Svcs | easy | verify.py |
| `washer-change` | E-commerce & Daily Svcs | easy | verify.py |
| `email-watch-shop` | E-commerce & Daily Svcs | hard | verify.py |
| `email-washer-change` | E-commerce & Daily Svcs | easy | verify.py |
| `email-writing` | Communication & Email | easy | verify.py |
| `email-reply` | Communication & Email | easy | verify.py |
| `schedule-change-request` | Calendar & Task Mgmt | medium | verify.py |
| `flight-booking` | E-commerce & Daily Svcs | medium | verify.py |
| `flight-info-change-notice` | Calendar & Task Mgmt | easy | verify.py |
| `flight-seat-selection` | E-commerce & Daily Svcs | easy | verify.py |
| `flight-seat-selection-failed` | E-commerce & Daily Svcs | hard | verify.py |
| `flight-cancel-claim` | E-commerce & Daily Svcs | hard | verify.py |
| `baggage-tracking-application` | E-commerce & Daily Svcs | easy | verify.py |
| `blog-site-from-scratch` | Coding & Software Dev | easy | verify.py |
| `blog-site-completion-from-starter` | Coding & Software Dev | easy | verify.py |
| `vue-build-fix-single` | DevOps & Env Repair | hard | verify.py |
| `vue-build-fix-chain` | DevOps & Env Repair | hard | verify.py |
| `skill-creation` | Documents & Knowledge | medium | evaluate.py |
| `skill-repository-curation` | Documents & Knowledge | medium | evaluate.py |
| `skill-supplementation` | Documents & Knowledge | medium | evaluate.py |
| `skill-conflict-resolution` | Documents & Knowledge | easy | evaluate.py |
| `skill-dependency-fix` | Documents & Knowledge | easy | evaluate.py |
| `noise-filtering` | Deep Research & Report | medium | **llm_judge** |
| `mixed-tool-memory` | Documents & Knowledge | easy | **llm_judge** |
| `incremental-update-ctp` | Documents & Knowledge | easy | **llm_judge** |
| `live-web-research-sqlite-fts5` | Deep Research & Report | medium | **llm_judge** |
| `conflict-repair-acb` | Documents & Knowledge | easy | **llm_judge** |
| `skill-combination` | Documents & Knowledge | easy | evaluate.py |
| `mint-diet-snack-log` | Health & Fitness | easy | verify.py |

## Docker Image Architecture

LiveClawBench uses a three-layer Docker image architecture:

1. **Base layer** (`liveclawbench-base:latest`): Shared runtime
   - Pre-built by `setup.sh` step 3
   - Pre-bakes: `python3 python3-pip python3-venv curl sqlite3 unzip`, Playwright Chromium, Bun runtime, directory scaffolding (`/workspace`, `/workspace/output`), mock infrastructure (`/opt/mock/bin/`, `/opt/mock/startup.d/`, `/opt/mock/data/`)
   - Built from: `docker/base/Dockerfile`

2. **Per-task layer** (`liveclawbench-{task}-base:latest`): Task-specific mock binaries and startup
   - Pre-built by `setup.sh` step 4 via `mock-platform/scripts/build-task-images.ts`
   - Contains only the mock binaries required for that task (defined in `mock-platform/config/task-binary-map.json`)
   - Includes per-task startup script at `/opt/mock/startup.d/{task}.sh` and shared entrypoint at `/opt/mock/entrypoint.sh`
   - Read-only startup path prevents agent tampering

3. **Task layer** (final task image): Task-specific environment and apps
   - Built by harbor from `tasks/{task}/environment/Dockerfile`
   - Inherits from the per-task layer: `FROM liveclawbench-{task}-base:latest`
   - Copies task-specific apps (shop-app, airline-app, etc.) and runs any additional setup steps

### Build Order

```bash
# 1. Build shared base (one-time, or when docker/base/Dockerfile changes)
docker build -t liveclawbench-base:latest docker/base/

# 2. Build all per-task images (one-time, or when mock binaries change)
cd mock-platform && bun run build:images

# 3. Build specific task image (harbor does this automatically on task run)
docker build -t liveclawbench-watch-shop tasks/watch-shop/environment/
```

> **Restricted network / proxy**: if your Docker daemon routes through a local proxy,
> configure daemon-level HTTP/HTTPS proxy before building — see
> `docs/en/guide/getting-started.md` (Troubleshooting → Docker Proxy Configuration).

> **Upgrading openclaw**: if the upstream base version changes (e.g. `2026.4.x`),
> update the `FROM` line in `docker/base/Dockerfile` only — all task Dockerfiles
> inherit automatically.

> **Harbor Dockerfile discovery**: harbor only builds `environment/Dockerfile` by default
> (path is hardcoded; build context is the `environment/` directory). Subdirectory
> Dockerfiles are **never built automatically** — they are only built if the task author
> explicitly references them in a custom `environment/docker-compose.yaml`.

## Task Structure

```
tasks/<task-name>/
├── task.toml           # difficulty, domain, factor_a1/a2/b1/b2, timeouts, allow_internet
├── instruction.md      # Agent-facing prompt
├── environment/
│   └── Dockerfile      # FROM liveclawbench-{task}-base:latest (built by setup.sh step 4)
├── solution/
│   └── solve.sh        # Reference solution
└── tests/
    ├── test.sh         # Runs the task-specific verifier and writes /logs/verifier/reward.txt
    └── verifier script # verify.py, evaluate.py, or llm_judge.py depending on the task
```

## Scoring Convention

Tasks use one of three evaluation patterns (verify.py, evaluate.py, or LLM judge); all write a
scalar 0.0–1.0 score to `/logs/verifier/reward.txt`. The most common pattern is `verify.py`
which prints `Score: X.X/1.0` with partial credit.

Tasks with sub-dimension scoring additionally write `/logs/verifier/reward.json`. Two conventions
apply universally: the `reward` key is mandatory (canonical aggregate, `float ∈ [0.0, 1.0]`);
non-numeric fields must use the `_meta_` prefix (harbor's verifier model enforces
`dict[str, float | int]` — string values cause a `ValidationError`).

See `docs/en/reference/task-format.md` for all three evaluation patterns and `docs/en/reference/jobs-output.md`
for the full jobs/ output directory layout when debugging results.

## Triple-Axis Complexity Framework

Tasks are annotated along three axes. See `docs/en/reference/complexity-framework.md` for the full
factor annotation table and controlled pair definitions.

- **A1 — Cross-Service Dependency**: Task requires coordinating across multiple services
- **A2 — Contaminated Initial State**: Environment starts in a broken/corrupt state
- **B1 — Implicit Goal Resolution**: Goal is not explicit; agent must infer constraints
- **B2 — Knowledge System Maintenance**: Task involves managing a persistent skill/knowledge repo
- A3 / A4 / B3 / C1 / C2 — expansion roadmap; see [docs/en/roadmap/future_factors.md](docs/en/roadmap/future_factors.md)

Each `task.toml` encodes which factors apply (`factor_a1 = 1`, etc.).

## Adding a New Task

1. Create `tasks/<task-name>/` with the structure above
2. `task.toml` must set `allow_internet = true` under `[environment]` if the agent needs LLM API access
3. Set complexity factors (`factor_a1`, `factor_a2`, `factor_b1`, `factor_b2`) per the triple-axis framework
4. Add task to `mock-platform/config/task-binary-map.json` if it requires mock services
5. `FROM liveclawbench-{task}-base:latest` in `environment/Dockerfile` (per-task layer built by setup.sh step 4)
6. `verify.py` must print `Score: X.X/1.0` and exit non-zero if score < 0.5
7. Check `docs/metadata/cases_registry.csv` for the next available `case_id`

## Validation & Tooling

```bash
python scripts/validate_tasks.py       # validates all tasks (required files, TOML fields, case_id uniqueness)
python scripts/validate_annotations.py # cross-checks factor annotations across task.toml / complexity-framework.md / cases_registry.csv
```

- `capability_dimension` field is deprecated — `validate_tasks.py` flags it as an error; do not add to new tasks

## Code Quality

All Python is formatted and linted with **ruff**, and `scripts/` is type-checked with **ty**.

### Manual checks (without pre-commit)

```bash
# Install tools (one-time)
uv pip install ruff ty

# Format all Python in-place
ruff format .

# Lint (auto-fix safe issues)
ruff check --fix .

# Type-check infrastructure scripts
ty check scripts/
```

### Set up pre-commit (recommended for contributors)

```bash
uv pip install pre-commit
pre-commit install      # hooks run automatically on git commit — replaces manual checks above
```

### Scope

| Target | ruff | ty |
|---|---|---|
| `scripts/` | ✓ | ✓ |
| `tasks/*/tests/` | ✓ | future (TODO) |
| `tasks/*/common/` | ✓ | — |
| `tasks/*/environment/` | ✓ | — |
| `tasks/skill-dependency-fix/environment/skills/` | excluded (intentional fixture) | — |
| `tasks/skill-repository-curation/environment/.skill_snapshot/` | excluded (intentional fixture) | — |
| `tasks/skill-repository-curation/environment/skills/` | excluded (intentional fixture) | — |

> **ty and `tasks/*/tests/`**: `verify.py` files use `sys.path.insert(0, "/workspace/environment/...")` which
> only resolves inside Docker containers, so ty cannot check them in CI without Docker. Tracked as a TODO in
> `pyproject.toml`.

## Ground Truth Numbers (verified from task.toml)

31 implemented tasks: A1=10, A2=6, B1=4, B2=11.
Difficulty: Easy=19, Medium=7, Hard=5.

## Known Issues

- Tasks with `factor_a1=1` (Cross-Service Dependency) involve multiple running services in the same container — check Dockerfile for service startup scripts
- The OpenClaw agent process does not auto-exit after completing its turns; harbor's agent timeout terminates it
- `openclaw --timeout` is an idle timeout and will not fire while the agent is actively processing

## Notes for Claude Code

- Always `Read` a file before `Write`; the Write tool rejects edits to unread files
- `docs/en/guide/` uses `custom/<MODEL>` + `CUSTOM_BASE_URL`/`CUSTOM_API_KEY` as the canonical provider-agnostic pattern — keep examples in this file consistent with that style
- harbor CLI lives in `.venv/bin/harbor` (local venv, not global); activate with `source .venv/bin/activate` or invoke directly as `.venv/bin/harbor`
