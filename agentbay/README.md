# LiveClawBench on AgentBay

This directory contains the public bridge between LiveClawBench tasks and
Harbor's AgentBay environment backend. It intentionally does not contain real
`imgc-*` image IDs; those belong to the account that built and activated the
AgentBay images.

## Install Harbor with AgentBay Support

`setup.sh` installs Harbor into the local `.venv`. To include the AgentBay SDK,
pass Harbor extras during setup:

```bash
HARBOR_EXTRAS=agentbay ./setup.sh
```

Until the AgentBay backend is released in a tag, install from the PR branch or
commit that contains it:

```bash
HARBOR_VERSION=agentbay-environment HARBOR_EXTRAS=agentbay ./setup.sh
```

## Image Lock Model

Harbor receives a task environment directory such as:

```text
tasks/watch-shop/environment
```

The AgentBay backend hashes the sorted file contents under that directory and
uses the first 12 hex characters as `env_hash12`. The reproducible lookup key is:

```text
liveclawbench/<task-name>/<env_hash12>
```

`prebuild=true` requires `agentbay/image_lock.toml` to contain a ready entry for
that exact task/hash. This prevents a large run from silently falling back to a
different image or to runtime environment upload.

Copy the example lock and fill it with active images:

```bash
cp agentbay/image_lock.example.toml agentbay/image_lock.toml
```

Each real entry should look like:

```toml
[images."liveclawbench/<task>/<env_hash12>"]
agentbay_image_id = "imgc-..."
activated = true
benchmark = "liveclawbench"
task = "<task>"
env_hash12 = "<env_hash12>"
environment_baked = true
skip_environment_upload = true
skip_setup = true
workdir = "/workspace"
entrypoint = ""
```

## Running Locally vs AgentBay

Local Docker remains the default path:

```bash
bash scripts/run_dataset.sh
```

AgentBay uses the same dataset registry, agent, model credentials, and judge
settings, but swaps the environment backend and image source:

```bash
bash scripts/run_agentbay_dataset.sh
```

Required environment variables:

```bash
export AGENTBAY_API_KEY="..."
export OPENAI_BASE_URL="https://your-openai-compatible-endpoint/v1"
export OPENAI_API_KEY="..."
export JUDGE_MODEL_ID="deepseek-v3.2"
```

`scripts/run_agentbay_dataset.sh` derives `JUDGE_BASE_URL` and `JUDGE_API_KEY`
from `OPENAI_BASE_URL` and `OPENAI_API_KEY` unless they are already set. The
script passes judge variables through `env_passthrough` so they are visible
inside AgentBay verifier commands without writing secrets into the lock file.

The AgentBay backend creates one session per Harbor trial. With 30 active task
images, `--n-concurrent 30` can start one session per task in the first wave;
actual capacity is controlled by the AgentBay account and policy.
