# Running Tasks

This guide covers how to use the Harbor CLI to run benchmark tasks, configure API credentials, and read evaluation results.

## Prerequisites

Harbor CLI must be installed. If you haven't run `./setup.sh`, do so first:

```bash
./setup.sh
harbor --version   # verify install
```

## Running a Single Task

```bash
harbor run \
  -p tasks/<task-name> \
  -a openclaw \
  -m custom/<YOUR_MODEL_ID> \
  -n 1 \
  -o jobs \
  --ae CUSTOM_BASE_URL="<YOUR_BASE_URL>" \
  --ae CUSTOM_API_KEY="<YOUR_API_KEY>" \
  --timeout-multiplier 2.0 \
  --debug
```

Run from the `LiveClawBench/` directory. Task paths are relative.

### Flag Reference

| Flag | Description |
|------|-------------|
| `-p <path>` | Path to the task directory (must contain `task.toml`) |
| `-a openclaw` | Agent name — always `openclaw` for ClawBench tasks |
| `-m <provider>/<model-id>` | Model to evaluate (see Model Names below) |
| `-n <int>` | Number of trials per task (use `1` for single evaluation) |
| `-o <dir>` | Output directory for job results (created if absent) |
| `--ae KEY=VALUE` | Inject an env var into the **agent process** only (via `openclaw.json`); repeatable |
| `--ee KEY=VALUE` | Inject an env var into the **environment container** (visible to all processes, including the verifier); repeatable |
| `--timeout-multiplier <float>` | Scale all timeouts in `task.toml` (default `1.0`) |
| `--debug` | Verbose logging; keeps container alive on failure for inspection |

### `--ae` vs `--ee`: which to use

Both flags inject environment variables into the Docker container, but they differ in scope:

| Flag | How it's injected | Visible to |
|------|-------------------|------------|
| `--ae` | Harbor writes the value into `~/.openclaw/openclaw.json`; only the `openclaw` agent process reads it | OpenClaw agent process only |
| `--ee` | Passed as `docker run -e KEY=VALUE`; set in the container's shell environment | All processes in the container — agent, `test.sh`, `verify.py`, `llm_judge.py` |

**Rule of thumb:** Use `--ae` for the model's API key and base URL (what the agent calls). Use `--ee` for anything the verifier needs to read — in particular, LLM-judge credentials (see [LLM-judge tasks](#llm-judge-tasks) below).

## Passing API Keys

API keys are injected into the container at runtime with `--ae` or `--ee`. They are never baked into the image.

```bash
# Single provider
harbor run ... --ae VOLCANO_ENGINE_API_KEY="$VOLCANO_ENGINE_API_KEY"

# Multiple providers
harbor run ... \
  --ae ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  --ae OPENAI_API_KEY="$OPENAI_API_KEY"
```

You can also source your `.env` file before running so the vars are available in your shell:

```bash
source .env
harbor run ... --ae VOLCANO_ENGINE_API_KEY="$VOLCANO_ENGINE_API_KEY"
```

## Model Name Format

Models are specified as `<provider>/<model-id>`:

| Format | Example |
|--------|---------|
| `volcengine-plan/<model-id>` | `volcengine-plan/kimi-k2.5` |
| `volcengine/<model-id>` | `volcengine/deepseek-v3-250324` |
| `moonshot/<model-id>` | `moonshot/kimi-k2.5` |
| `anthropic/<model-id>` | `anthropic/claude-opus-4-6` |
| `openai/<model-id>` | `openai/gpt-4o` |
| `custom/<model-id>` | `custom/deepseek-chat` |

`volcengine` and `volcengine-plan` are explicitly registered in the OpenClaw adapter. Standard providers (Anthropic, OpenAI, Gemini) use auto-discovery via env vars. Use `custom/` for any other OpenAI-compatible endpoint — pass `CUSTOM_BASE_URL` and `CUSTOM_API_KEY` via `--ae`.

### Adding a Custom Provider

**Zero-code option:** Use the built-in `custom/` prefix to test any OpenAI-compatible endpoint without modifying source code:

```bash
harbor run -p tasks/watch-shop -a openclaw \
  -m custom/deepseek-chat \
  -n 1 -o jobs \
  --ae CUSTOM_BASE_URL="https://api.deepseek.com/v1" \
  --ae CUSTOM_API_KEY="$DEEPSEEK_API_KEY"
```

**Optional model parameters** — override defaults with additional `--ae` flags:

| `--ae` variable | Default | Purpose |
|---|---|---|
| `CUSTOM_CONTEXT_WINDOW` | `128000` | Model context window (tokens) |
| `CUSTOM_MAX_TOKENS` | `4096` | Max output tokens per response |
| `CUSTOM_REASONING` | `false` | Enable reasoning/thinking mode (`true`/`1`/`yes`) |
| `CUSTOM_API` | `openai-completions` | API type (`openai-completions` or `openai-responses`) |

Example with a large-context reasoning model:

```bash
harbor run -p tasks/watch-shop -a openclaw \
  -m custom/my-model \
  -n 1 -o jobs \
  --ae CUSTOM_BASE_URL="https://api.example.com/v1" \
  --ae CUSTOM_API_KEY="$MY_API_KEY" \
  --ae CUSTOM_CONTEXT_WINDOW=256000 \
  --ae CUSTOM_MAX_TOKENS=16384 \
  --ae CUSTOM_REASONING=true
```

> **Auto-inference**: Harbor automatically injects `--thinking` based on `CUSTOM_REASONING`:
> - `CUSTOM_REASONING=true` → `--thinking medium` (balances depth and token cost)
> - `CUSTOM_REASONING=false` → `--thinking off` (explicitly disables thinking)
>
> This makes `CUSTOM_REASONING` the single entry point for managing evaluation defaults. To use a different intensity, pass `--ak thinking=<level>` explicitly to override (valid levels: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `adaptive`).
>
> **Priority chain**: `--ak thinking=X` (highest) > `CUSTOM_REASONING` auto-inject > OpenClaw internal default. Explicit `--ak` always wins.
>
> **`--ak` vs `--ae`**: Use `--ak key=value` (agent kwarg) to set agent CLI flags such as `thinking`. Use `--ae KEY=VALUE` (agent env) to set environment variables passed to the container (e.g., API keys). Only `--ak` feeds into CLI flag generation; `--ae` values are injected into the container process environment.

**Permanent registration:** If you want a named provider (e.g., `my-provider/model-id`) available without `--ae CUSTOM_BASE_URL`, add it to `harbor/src/harbor/agents/installed/openclaw.py` under `_PROVIDER_CONFIGS`:

```python
"my-provider": {
    "baseUrl": "https://api.example.com/v1",
    "api": "openai-completions",
    "apiKey": "${MY_PROVIDER_API_KEY}",   # ${VAR} resolved by OpenClaw env-substitution at runtime
},
```

Then use `my-provider/model-id` as the `-m` value and pass `--ae MY_PROVIDER_API_KEY="your-key"`.

### Provider Routing for Thinking/Reasoning

Different LLM APIs use different request body fields to enable deep thinking. Harbor leverages OpenClaw's existing provider wrappers to inject the correct parameters — choose the provider name based on which API field your endpoint expects:

| Scenario | Provider | Injected API parameter |
|----------|----------|----------------------|
| Model supports `reasoning.effort` | `-m openrouter/<model>` | `reasoning: { effort: "<level>" }` |
| Model supports `thinking.type` | `-m moonshot/<model>` | `thinking: { type: "enabled" }` |
| Anthropic native model | `-m anthropic/<model>` | Native thinking API |
| Generic OpenAI-compatible | `-m custom/<model>` | No thinking parameter injection |

All three (`openrouter`, `moonshot`, `custom`) use the same `CUSTOM_*` env vars for configuration:

```bash
# Example: VolcEngine endpoint that accepts reasoning.effort
harbor run -p tasks/<task> -a openclaw \
  -m openrouter/<model-id> -n 1 -o jobs \
  --ae CUSTOM_BASE_URL="https://ark.cn-beijing.volces.com/api/v3" \
  --ae CUSTOM_API_KEY="$VOLCANO_ENGINE_API_KEY" \
  --ae CUSTOM_REASONING=true

# Example: endpoint that accepts thinking.type
harbor run -p tasks/<task> -a openclaw \
  -m moonshot/<model-id> -n 1 -o jobs \
  --ae CUSTOM_BASE_URL="https://api.example.com/v1" \
  --ae CUSTOM_API_KEY="$API_KEY" \
  --ae CUSTOM_REASONING=true
```

When `CUSTOM_BASE_URL` is not set, `openrouter` and `moonshot` fall back to their default service endpoints (OpenRouter and Moonshot respectively).

> **Model name format**: Use two-part names like `openrouter/<model-id>` (e.g., `openrouter/kimi-k2.5`). Three-part names like `openrouter/zai/glm-5` will not route correctly because Harbor splits on the last `/`, making the provider `openrouter/zai` instead of `openrouter`.

## Reading Results

After a run completes, Harbor writes output to the directory specified with `-o`:

```
jobs/
└── <job-id>/                          # timestamp, e.g. 2026-03-29__21-11-23
    ├── config.json                    # job-level config snapshot
    ├── result.json                    # aggregated reward distribution
    └── <task-name>__<random>/         # one subdirectory per trial
        ├── verifier/
        │   ├── reward.txt             # scalar score (0.0–1.0)
        │   └── test-stdout.txt        # verifier stdout/stderr
        └── agent/
            ├── openclaw.txt           # full agent session log
            └── trajectory.json        # ATIF structured trajectory
```

Check all scores at once:

```bash
find jobs -name reward.txt | sort | xargs -I{} sh -c 'echo "{}: $(cat {})"'
```

| Score | Meaning |
|-------|---------|
| `1.0` | Task fully solved |
| `0.5` | Meaningful progress (partial credit) |
| `0.0` | Task failed |

## Running Multiple Trials

Use `-n` to run multiple independent trials of the same task:

```bash
harbor run -p tasks/flight-seat-selection -a openclaw \
  -m anthropic/claude-opus-4-6 -n 3 -o jobs \
  --ae ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
```

## Running the Full Dataset

LiveClawBench registers its 30 tasks as a dataset named `liveclawbench@0.1.0` in the local `registry.json`.

### Option 1: Local registry (recommended for development)

```bash
harbor run --dataset liveclawbench@0.1.0 \
  --registry-path ./registry.json \
  -a openclaw \
  -m custom/<YOUR_MODEL_ID> \
  --n-concurrent 4 \
  -o jobs \
  --ae CUSTOM_BASE_URL="<YOUR_BASE_URL>" \
  --ae CUSTOM_API_KEY="<YOUR_API_KEY>" \
  --ee JUDGE_BASE_URL="<YOUR_JUDGE_BASE_URL>" \
  --ee JUDGE_API_KEY="<YOUR_JUDGE_API_KEY>" \
  --ee JUDGE_MODEL_ID="deepseek-v3.2"
```

> **Why `--registry-path`?** Harbor's `--dataset` flag by default fetches the registry from `github.com/laude-institute/harbor`. Since `liveclawbench` is only registered in the local `registry.json`, you must pass `--registry-path ./registry.json` to tell Harbor where to find the dataset definition.

### Option 2: Per-task loop (alternative, avoids timestamp collisions)

For running tasks in parallel without relying on Harbor's `--n-concurrent`, use a script that assigns each task its own output directory:

```bash
# See scripts/run_runnability_check.sh for a complete example
for task in tasks/*/; do
  harbor run -p "$task" -a openclaw \
    -m moonshot/kimi-k2.5 \
    -n 1 -o "jobs/$(basename $task)" \
    --ae CUSTOM_BASE_URL=... --ae CUSTOM_API_KEY=... &
done
wait
```

This avoids the timestamp collision issue entirely because each `harbor run` writes to a distinct `jobs/<task-name>/` directory.

> **Tip:** When using the per-task loop approach, remember to also pass `--ee JUDGE_*` variables for the 5 LLM-judge tasks. See [LLM-judge tasks](#llm-judge-tasks) for the full list and explanation.

### Option 3: Use the provided script

```bash
bash scripts/run_dataset.sh
```

This script wraps the `--dataset` command with the correct `--registry-path`, judge credentials, and sensible defaults (`--n-concurrent 4`, `--timeout-multiplier 2.0`).

## Collecting Metrics

After a run (single task or full dataset), scores are in `reward.txt` files nested inside `jobs/`.

### Quick score summary

```bash
# Print path : score for every completed trial
find jobs -name reward.txt | sort | xargs -I{} sh -c 'echo "{}: $(cat {})"'
```

### Structured summary table (Python)

```python
import glob, os

tasks = sorted(d for d in os.listdir("tasks") if os.path.isdir(f"tasks/{d}"))
print(f"{'Task':<45} {'Score':>6}  Status")
print("-" * 60)
for task in tasks:
    # For per-task loop output: jobs/<task-name>/*/verifier/reward.txt
    # For dataset run output: jobs/<timestamp>/<task-name>__/verifier/reward.txt
    files = sorted(glob.glob(f"jobs/**/{task}__*/verifier/reward.txt"))
    if not files:
        files = sorted(glob.glob(f"jobs/{task}/**/verifier/reward.txt"))
    if files:
        score_str = open(files[-1]).read().strip()
        try:
            score = float(score_str)
            status = "✅" if score >= 0.5 else "❌"
        except ValueError:
            status = "⚠️ parse error"
            score_str = "?"
    else:
        score_str, status = "missing", "⚠️ no result"
    print(f"{task:<45} {score_str:>6}  {status}")
```

### What to check when a score is missing or unexpected

| Symptom | Where to look |
|---------|---------------|
| `reward.txt` absent | `verifier/test-stdout.txt` — did the verifier run? `trial.log` — agent timeout? |
| Score is 0.0 | `verifier/test-stdout.txt` — which assertion failed |
| Agent never started | `agent/command-0/return-code.txt`, `agent/command-1/return-code.txt` |
| Harbor-level crash | `<trial>/result.json` → `exception_info` field |
| Multiple `reward.txt` files per task | Use `jobs/<task-name>/` structure (per-task loop) or pick the latest by timestamp |

See [Jobs Output](../reference/jobs-output.md) for the full directory layout and field reference.

## LLM-judge tasks

Five tasks use an LLM-as-judge verifier (`llm_judge.py`) instead of pure rule-based scoring. These tasks require a **separate judge model API** that the verifier calls during the scoring phase — distinct from the model under evaluation.

### Required environment variables

The judge credentials must be passed via `--ee` (not `--ae`) because `llm_judge.py` runs inside the verifier phase as an independent process, not as part of the OpenClaw agent:

| Variable | Description | Default |
|----------|-------------|---------|
| `JUDGE_BASE_URL` | OpenAI-compatible base URL for the judge model | *(none — required)* |
| `JUDGE_MODEL_ID` | Model name to use for judging | `deepseek-v3.2` |
| `JUDGE_API_KEY` | API key for the judge endpoint | *(none — required)* |

`JUDGE_BASE_URL` and `JUDGE_API_KEY` are **mandatory**. `llm_judge.py` raises a `RuntimeError` immediately if either is missing — there are no hardcoded fallbacks.

### Example

```bash
harbor run -p tasks/noise-filtering -a openclaw \
  -m custom/<YOUR_MODEL_ID> \
  -n 1 -o jobs \
  --ae CUSTOM_BASE_URL="<YOUR_BASE_URL>" \
  --ae CUSTOM_API_KEY="<YOUR_API_KEY>" \
  --ee JUDGE_BASE_URL="<YOUR_BASE_URL>" \
  --ee JUDGE_MODEL_ID="qwen3-235b-a22b-instruct-2507" \
  --ee JUDGE_API_KEY="<YOUR_API_KEY>" \
  --timeout-multiplier 2.0 --debug
```

The judge model can be the same endpoint as the agent model or a different one. Using a stronger, cheaper model for judging than for the agent under test is a common pattern.

### Covered tasks

| Task | Difficulty |
|------|-----------|
| `noise-filtering` | medium |
| `incremental-update-ctp` | medium |
| `conflict-repair-acb` | medium |
| `mixed-tool-memory` | hard |
| `live-web-research-sqlite-fts5` | hard |

## Hard Task Tips

- Use `--timeout-multiplier 2.0` for `hard` difficulty tasks; some may need `3.0`
- `--debug` keeps the container alive after failure for manual inspection
- Check `/tmp/*.log` files inside a failed container for service startup errors

## Known Issues

### Timestamp collision when running tasks concurrently

Harbor names each job directory after the UTC second the run starts
(e.g. `jobs/2026-03-29__21-11-23`). When multiple `harbor run -p tasks/<X>` commands
fire in the same second — for example from a parallel shell loop — some processes
may find the directory already created by another task and fail with:

```
FileExistsError: Job directory jobs/<timestamp> already exists and
cannot be resumed with a different config.
```

**Resolution:** use a different `-o` directory for the retry run:

```bash
harbor run -p tasks/<task> ... -o jobs_retry
```

Or, if you are re-running a single task and the existing directory is stale, delete it first:

```bash
# ⚠ Only if you don't mind losing the prior result
rm -rf jobs/<conflicting-timestamp>
harbor run -p tasks/<task> ... -o jobs
```

To avoid the collision entirely when scripting parallel runs, use one of these approaches:

1. **Per-task output directories** (`-o "jobs/<task-name>"`) — used by `scripts/run_runnability_check.sh`
2. **`--dataset` with `--registry-path`** — harbor manages job directories internally (`scripts/run_dataset.sh`)
3. Serialize task start-up with a short delay between launches
