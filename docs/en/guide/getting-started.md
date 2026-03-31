# Getting Started

This guide walks you through setting up LiveClawBench and running your first evaluation task.

## Prerequisites

You need the following tools installed before running `setup.sh`:

| Tool | Minimum Version | Install |
|------|-----------------|---------|
| Python | 3.12+ | [python.org](https://www.python.org/downloads/) or `uv python install 3.12` |
| [uv](https://docs.astral.sh/uv/) | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Docker | 24+ | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) |
| Git | 2.x | [git-scm.com](https://git-scm.com/downloads) |

> **Note:** Docker must be running before you call `harbor run`.

## Running `./setup.sh`

From the repository root:

```bash
./setup.sh
```

The script performs three steps:

1. **Prerequisite checks** — verifies git, uv, Docker, and Python ≥ 3.12 are available. Exits with an error and install hint if any are missing.

2. **Harbor installation** — creates a local `.venv` inside `LiveClawBench/` and installs the
   `harbor` CLI directly from the [claw-harbor](https://github.com/Mosi-AI/claw-harbor) GitHub
   URL. This step is idempotent: running `setup.sh` a second time skips venv creation if `.venv`
   already exists.

3. **.env setup** — copies `.env.example` to `.env` if `.env` does not exist. If `.env` already
   exists, the script reminds you to diff against the template for new variables.

## Editing `.env`

Open `.env` and uncomment the block matching your provider:

```bash
# Option C example — VolcEngine
VOLCANO_ENGINE_API_KEY=your-key-here
```

**API keys are never committed.** `.env` is listed in `.gitignore`.

### Choosing a provider

- **VolcEngine** (`volcengine/` or `volcengine-plan/`): pass key via `--ae VOLCANO_ENGINE_API_KEY="$VOLCANO_ENGINE_API_KEY"`
- **Anthropic**: set `ANTHROPIC_API_KEY` — OpenClaw auto-discovers it
- **OpenAI** (`openai/<model-id>`): set `OPENAI_API_KEY` — calls `api.openai.com`, no other config needed
- **Any OpenAI-compatible endpoint** (DeepSeek, Moonshot, local vLLM, etc.): use `custom/<model-id>` as the model name; pass the base URL and API key via `--ae`:
  ```bash
  harbor run -p tasks/watch-shop -a openclaw \
    -m custom/deepseek-chat \
    -n 1 -o jobs \
    --ae CUSTOM_BASE_URL="https://api.deepseek.com/v1" \
    --ae CUSTOM_API_KEY="$DEEPSEEK_API_KEY"
  ```
  Optional flags `CUSTOM_CONTEXT_WINDOW`, `CUSTOM_MAX_TOKENS`, `CUSTOM_REASONING`, and `CUSTOM_API`
  let you tune model parameters without code changes — see
  [Running Tasks — Adding a Custom Provider](running-tasks.md#adding-a-custom-provider).
- **Gemini**: set `GEMINI_API_KEY`

All keys are injected into the agent container via `--ae KEY="$KEY"` at run time.

## Verifying Setup

Activate the venv, then check the harbor CLI is installed:

```bash
source .venv/bin/activate
harbor --version
```

Run a quick smoke test with the simplest task:

```bash
harbor run -p tasks/watch-shop -a openclaw \
  -m custom/<YOUR_MODEL_ID> \
  -n 1 -o jobs \
  --ae CUSTOM_BASE_URL="<YOUR_BASE_URL>" \
  --ae CUSTOM_API_KEY="<YOUR_API_KEY>" \
  --debug
```

For example, using DeepSeek:

```bash
harbor run -p tasks/watch-shop -a openclaw \
  -m custom/deepseek-chat \
  -n 1 -o jobs \
  --ae CUSTOM_BASE_URL="https://api.deepseek.com/v1" \
  --ae CUSTOM_API_KEY="$DEEPSEEK_API_KEY" \
  --debug
```

After the run, check the score:

```bash
cat jobs/*/logs/verifier/reward.txt
```

A value of `1.0` means the task was solved. `0.5` means partial credit.

## Troubleshooting

**`harbor: command not found`**
Activate the virtual environment first: `source .venv/bin/activate`. Alternatively, run harbor
directly via `.venv/bin/harbor`.

**`Cannot connect to the Docker daemon`**
Start Docker Desktop (macOS/Windows) or run `sudo systemctl start docker` (Linux).

**`Error: API key not found` / `401 Unauthorized`**
Check that you passed `--ae KEY="$KEY"` on the command line and that the env var is set in your shell (e.g. `echo $CUSTOM_API_KEY` or `echo $VOLCANO_ENGINE_API_KEY`).

**`allow_internet` errors**
If a task needs to call external APIs but fails, check `task.toml` — `allow_internet = true` must be set under `[environment]`. All OpenClaw tasks already have this set.

**Timeouts on hard tasks**
Use `--timeout-multiplier 2.0` (or higher) to scale all `task.toml` timeouts.

**Using a non-standard OpenAI-compatible provider**
Use `custom/<model-id>` with `--ae CUSTOM_BASE_URL` and `--ae CUSTOM_API_KEY` — no code changes needed.
See [Running Tasks — Adding a Custom Provider](running-tasks.md#adding-a-custom-provider) for adding a permanent entry to `_PROVIDER_CONFIGS`.

**`docker build` fails with `502` / `connection refused` on `deb.debian.org`**

Your Docker daemon is routing through a proxy that supports HTTPS CONNECT tunneling but
not plain HTTP forwarding (common with local dev proxies). Configure the Docker daemon
proxy so that `apt-get` inside containers can reach `deb.debian.org` over HTTPS.

_macOS (Docker Desktop)_ — edit `~/.docker/config.json` (create if absent), then restart
Docker Desktop:

```json
{
  "proxies": {
    "default": {
      "httpProxy":  "http://host.docker.internal:<PORT>",
      "httpsProxy": "http://host.docker.internal:<PORT>",
      "noProxy":    "localhost,127.0.0.1"
    }
  }
}
```

`host.docker.internal` resolves to the host machine from inside containers. Replace
`<PORT>` with your proxy port (e.g. `7897`).

_Linux (systemd)_ — create a systemd drop-in and restart the daemon:

```bash
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo tee /etc/systemd/system/docker.service.d/http-proxy.conf << 'EOF'
[Service]
Environment="HTTP_PROXY=http://<PROXY_HOST>:<PORT>"
Environment="HTTPS_PROXY=http://<PROXY_HOST>:<PORT>"
Environment="NO_PROXY=localhost,127.0.0.1"
EOF
sudo systemctl daemon-reload && sudo systemctl restart docker
```

**No proxy?** If `deb.debian.org` is directly reachable (open networks), no configuration
is required — `docker build` works as-is.
