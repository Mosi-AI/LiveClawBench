# `jobs/` Output Structure Reference

This document describes every file and directory produced by `harbor run -o jobs`, how each file
is created, and how to use them when debugging evaluation results.

## Overview

`-o jobs` sets the **output root directory**. Each `harbor run` invocation creates one
`<job-id>/` subdirectory (named after the UTC start time, `YYYY-MM-DD__HH-MM-SS`). Inside the
job directory, every **trial** — one agent run on one task — gets its own `<trial-name>/`
subdirectory (format: `<task-name>__<random-suffix>`).

```
jobs/
└── 2026-03-21__12-37-54/       ← job directory (one per harbor run)
    └── baggage-tracking-application__2hoJ9jE/   ← trial directory
```

---

## Complete Directory Tree

```
jobs/
└── <job-id>/                             # e.g. 2026-03-21__12-37-54
    ├── config.json                       # Full job configuration snapshot
    ├── result.json                       # Job-level aggregated results (reward distribution, error counts)
    ├── job.log                           # Harbor orchestrator log
    └── <trial-name>/                     # e.g. baggage-tracking-application__2hoJ9jE
        ├── config.json                   # Full trial config (agent / env / timeout / model)
        ├── result.json                   # Full trial result (score, token usage, exceptions)
        ├── trial.log                     # Harbor trial-layer log
        ├── exception.txt                 # Exception traceback if the trial crashed (may not exist)
        │
        ├── agent/                        # bind-mount → /logs/agent/ inside container
        │   ├── install.sh                # Copy of the agent installation script
        │   ├── setup/                    # Output of the setup phase
        │   │   ├── stdout.txt            # Combined stdout of setup commands
        │   │   └── return-code.txt       # Exit code of the setup phase
        │   ├── command-0/                # First executed command (MCP / model / env injection)
        │   │   ├── command.txt           # Exact shell command that was run
        │   │   └── return-code.txt       # Exit code
        │   ├── command-1/                # Second command (agent main process)
        │   │   ├── command.txt           # Exact shell command that was run
        │   │   ├── stdout.txt            # Agent stdout
        │   │   └── return-code.txt       # Exit code (0 = clean exit, non-zero = error / timeout kill)
        │   ├── openclaw.txt              # openclaw stdout + stderr captured via tee
        │   ├── trajectory.json           # ATIF v1.2 trajectory (generated when session JSONL is found)
        │   └── openclaw-state/           # openclaw internal state (OPENCLAW_STATE_DIR)
        │       └── agents/main/sessions/
        │           └── harbor.jsonl      # Raw session JSONL — one JSON object per message
        │
        ├── verifier/                     # bind-mount → /logs/verifier/ inside container
        │   ├── reward.txt                # Float reward value written by test.sh (0.0 / 0.5 / 1.0); present when test.sh uses the text format
        │   ├── reward.json               # JSON reward written by test.sh; present when test.sh uses the JSON format (e.g. multi-dimensional scores)
        │   └── test-stdout.txt           # stdout + stderr of test.sh (stderr is redirected via 2>&1)
        │
        └── artifacts/                    # bind-mount → /logs/artifacts/ inside container
                                          # Task-specific outputs (screenshots, exports, etc.)
```

---

## File Lifecycle: Container Mount Mechanism

Understanding *when* and *how* files appear on the host is essential for debugging.

### 1. Host directories created before container starts

`Trial.__init__` calls `TrialPaths.mkdir()` **before** the Docker container is launched. This
creates the `agent/`, `verifier/`, and `artifacts/` subdirectories on the host so that bind
mounts have a target to attach to.

### 2. Bind mounts (local Docker only)

`DockerEnvironment` reads `docker-compose-base.yaml` and configures three bind mounts:

| Host path (under `<trial-name>/`) | Container path |
|-----------------------------------|----------------|
| `agent/`                          | `/logs/agent/` |
| `verifier/`                       | `/logs/verifier/` |
| `artifacts/`                      | `/logs/artifacts/` |

Any write inside the container to `/logs/` is **immediately visible** on the host — no `docker cp`
step is required or performed.

### 3. Real-time disk writes

Because of the bind mount, you can `tail -f` log files while a trial is still running:

```bash
tail -f jobs/<job-id>/<trial-name>/agent/openclaw.txt
```

### 4. Ownership fix after container stop

After the container exits, Harbor runs a `chown` pass over the `/logs/` tree to transfer
ownership from `root` (the container user) to the host user, preventing permission issues when
you later read or delete the files.

### 5. Non-Docker environments (Daytona / Modal / E2B)

These environments return `is_mounted = False`. Harbor detects this and calls
`environment.download_dir()` after the trial completes to pull logs down to the host. The
resulting on-disk structure is identical; only the *transfer mechanism* differs.

---

## Key File Field Reference

### `<job-id>/result.json`

Aggregated statistics across all trials in the job.

| JSON path | Meaning |
|-----------|---------|
| `stats.evals.<agent>__<model>__<dataset>.reward_stats` | Reward frequency distribution: `{reward_key: {reward_value: [trial_name, ...]}}`. All reward keys from `rewards` are tracked independently; the conventional key is `"reward"`. |
| `stats.evals.<agent>__<model>__<dataset>.n_errors` | Count of trials that raised an exception |

### `<trial-name>/result.json`

Single trial result.

| JSON path | Meaning |
|-----------|---------|
| `verifier_result.rewards` | Dict of all reward keys written by `test.sh` (e.g. `{"reward": 1.0}` for `reward.txt`, or `{"reward": 0.8, "accuracy": 0.9}` for a multi-dimensional `reward.json`). Harbor tracks every key independently. |
| `exception_info` | Structured exception if Harbor itself crashed during the trial |
| `agent_result.n_input_tokens` | Input token count reported by the agent |
| `agent_result.n_output_tokens` | Output token count reported by the agent |

### `agent/openclaw.txt`

Full stdout + stderr of the `openclaw` process, captured via `tee`. When running with `--json`,
the final line contains a complete JSON object including:

```jsonc
{
  "meta": {
    "agentMeta": {
      "usage": { "inputTokens": 12345, "outputTokens": 678 }
    }
  }
}
```

This is the **fallback token-usage source** when `trajectory.json` is missing.

### `agent/trajectory.json`

ATIF v1.2 trajectory. Present only when the openclaw session JSONL (`harbor.jsonl`) was
successfully located and converted. Contains all steps with per-step token usage. If this file is
**absent**, check `harbor.jsonl` first.

### `agent/openclaw-state/…/harbor.jsonl`

The raw OpenClaw session file — one JSON object per line. This is the primary data source for
`trajectory.json`. Each message object may carry a `usage` field with token counts.

### `verifier/reward.txt`

A single line containing a float (e.g. `1.0`, `0.5`, `0.0`). Written by `test.sh` inside the
container. If the file is **absent**, check for `reward.json` before concluding the verifier did
not run (the agent may have timed out, or the task uses the JSON format instead).

### `verifier/reward.json`

A JSON object written by `test.sh` when the task uses multi-dimensional scoring (e.g.
`{"reward": 0.8, "accuracy": 0.9}`). Harbor reads this only when `reward.txt` is absent.
Every `float | int` key is tracked independently in `reward_stats`. Non-numeric fields must
use the `_meta_` prefix — harbor's verifier model enforces `dict[str, float | int]` and an
un-prefixed string value causes a `ValidationError` at parse time. See
[reward.json rules](../guide/adding-tasks.md#verifypy-contract) in the Adding Tasks guide.

---

## Troubleshooting Quick Reference

| Symptom | Check first | Check next |
|---------|-------------|------------|
| Score is 0.0 | `verifier/test-stdout.txt` (what test assertion failed?) | `verifier/reward.txt` to confirm the value was written |
| `trajectory.json` missing | `agent/openclaw-state/…/harbor.jsonl` exists? | `agent/openclaw.txt` for agent startup errors |
| Trial has an exception | `<trial>/result.json` → `exception_info` | `trial.log` for the Harbor-layer traceback |
| Agent never started / timed out | `agent/command-0/return-code.txt` (config injection failure?) | `agent/command-1/return-code.txt` (main process exit code) |
| Environment build failed | `trial.log` — search for `DockerBuild` | `agent/install.sh` to inspect the installation script |
| Token usage is null | `agent/openclaw.txt` — final JSON `usage` field | `harbor.jsonl` — per-message `usage` fields |
| `verifier/reward.txt` absent | Check `verifier/reward.json` (task may use JSON format) | If both absent, agent timed out before the verifier phase — confirm via `trial.log` |

---

## Example: Reading a Trial Result

```bash
JOB=jobs/2026-03-21__12-37-54
TRIAL=$JOB/baggage-tracking-application__2hoJ9jE

# Quick score check
cat $TRIAL/verifier/reward.txt

# What did the test suite say?
cat $TRIAL/verifier/test-stdout.txt

# Was there a Harbor-level exception?
python3 -c "import json; d=json.load(open('$TRIAL/result.json')); print(d.get('exception_info'))"

# Follow the agent live (while trial is still running)
tail -f $TRIAL/agent/openclaw.txt
```
