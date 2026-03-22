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
| `--ae KEY=VALUE` | Inject an env var into the agent container; repeatable |
| `--timeout-multiplier <float>` | Scale all timeouts in `task.toml` (default `1.0`) |
| `--debug` | Verbose logging; keeps container alive on failure for inspection |

## Passing API Keys

API keys are injected into the container at runtime with `--ae`. They are never baked into the image.

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

**Permanent registration:** If you want a named provider (e.g., `my-provider/model-id`) available without `--ae CUSTOM_BASE_URL`, add it to `harbor/src/harbor/agents/installed/openclaw.py` under `_PROVIDER_CONFIGS`:

```python
"my-provider": {
    "baseUrl": "https://api.example.com/v1",
    "api": "openai-completions",
    "apiKey": "${MY_PROVIDER_API_KEY}",   # ${VAR} resolved by OpenClaw env-substitution at runtime
},
```

Then use `my-provider/model-id` as the `-m` value and pass `--ae MY_PROVIDER_API_KEY="your-key"`.

## Reading Results

After a run completes, Harbor writes output to the directory specified with `-o`:

```
jobs/
└── <job-id>/
    └── <trial-id>/
        └── logs/
            ├── verifier/
            │   └── reward.txt        # Final score: 0.0, 0.5, or 1.0
            └── agent/
                └── openclaw.txt      # Full agent session log
```

Check all scores at once:

```bash
cat jobs/*/logs/verifier/reward.txt
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

To evaluate against all 29 tasks defined in `registry.json`:

```bash
harbor run --dataset liveclawbench@1.0 \
  -a openclaw \
  -m custom/<YOUR_MODEL_ID> \
  --n-concurrent 4 \
  -o jobs \
  --ae CUSTOM_BASE_URL="<YOUR_BASE_URL>" \
  --ae CUSTOM_API_KEY="<YOUR_API_KEY>"
```

`--n-concurrent` controls how many tasks run in parallel. Start low (2–4) to avoid resource exhaustion.

## Hard Task Tips

- Use `--timeout-multiplier 2.0` for `hard` difficulty tasks; some may need `3.0`
- `--debug` keeps the container alive after failure for manual inspection
- Check `/tmp/*.log` files inside a failed container for service startup errors
