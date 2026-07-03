# LiveClawBench

> Benchmarking LLM Agents on Complex, Real-World Assistant Tasks

[![Paper](https://img.shields.io/badge/Paper-arXiv-orange)](https://arxiv.org/pdf/2604.13072)
[![Leaderboard](https://img.shields.io/badge/Leaderboard-Live-brightgreen)](https://mosi-ai.github.io/LiveClawBench/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Tasks](https://img.shields.io/badge/Tasks-134-green)](tasks/)
[![Dataset](https://img.shields.io/badge/HuggingFace-7.46k_Trajectories-yellow)](https://huggingface.co/datasets/Mosi-AI/LiveClawBench)

LiveClawBench evaluates LLM agents on realistic, multi-step assistant tasks using the [Harbor](https://github.com/Mosi-AI/claw-harbor) framework and the [OpenClaw](https://github.com/openclaw/openclaw) agent platform.

## Overview

![LiveClawBench Overview](assets/LiveClawBench_Overview.jpg)

LLM agents are increasingly expected to handle real-world assistant tasks, yet existing
benchmarks evaluate them under isolated difficulty sources. LiveClawBench addresses this
by introducing a **Triple-Axis Complexity Framework** derived from empirical analysis of
production OpenClaw usage data, and building a benchmark with explicit factor
annotations, deterministic mock environments, and outcome-driven evaluation.

> **Status** (updated June 2026): 134 tasks validated across 10 domains, automated evaluation harness complete.
> Leaderboard scores for 17 models and 6,834 v0.2.1 agent trajectories (ATIF-v1.2; 17 models x 134 tasks x 3 runs) are published on
> [HuggingFace](https://huggingface.co/datasets/Mosi-AI/LiveClawBench), with the public leaderboard at
> [mosi-ai.github.io/LiveClawBench](https://mosi-ai.github.io/LiveClawBench/).

**Paper**: [LiveClawBench: Benchmarking LLM Agents on Complex, Real-World Assistant Tasks](https://arxiv.org/pdf/2604.13072)

## Triple-Axis Complexity Framework

Task difficulty is characterized along three orthogonal axes. The benchmark covers six
complexity factors across Environment, Cognitive, and Adaptability dimensions.

| Factor | Axis | Description | Coverage |
|--------|------|-------------|----------|
| **A1** Cross-Service Dependency | Environment | Coordinate multiple independent services in a single workflow | ✓ 45 tasks |
| **A2** Contaminated Initial State | Environment | Diagnose and repair corrupted environments before acting | ✓ 38 tasks |
| **B1** Implicit Goal Resolution | Cognitive | Infer missing constraints or seek clarification when ambiguous | ✓ 43 tasks |
| **B2** Knowledge System Maintenance | Cognitive | Create, update, and repair persistent skill/knowledge artifacts | ✓ 17 tasks |
| **C1** Runtime State Mutation | Adaptability | Detect and adapt when environment state changes during execution | ✓ 7 tasks |
| **C2** Runtime Verification | Adaptability | Verify action outcomes and handle silent failures | ✓ 6 tasks |

## Quick Start

```bash
git clone https://github.com/Mosi-AI/LiveClawBench.git
cd LiveClawBench
./setup.sh          # installs harbor CLI, builds Docker images, creates .env

# Edit .env with your API key, then run a task:
source .venv/bin/activate
harbor run -p tasks/watch-shop -a openclaw -m moonshot/<YOUR_MODEL_ID> \
  -n 1 -o jobs \
  --ae CUSTOM_BASE_URL="<YOUR_BASE_URL>" \
  --ae CUSTOM_API_KEY="<YOUR_API_KEY>"
```

To run all 134 tasks:

```bash
harbor run --dataset liveclawbench@0.2.1 -a openclaw \
  -m moonshot/<YOUR_MODEL_ID> --n-concurrent 4 -o jobs \
  --ae CUSTOM_BASE_URL="<YOUR_BASE_URL>" \
  --ae CUSTOM_API_KEY="<YOUR_API_KEY>" \
  --ee JUDGE_BASE_URL="<JUDGE_BASE_URL>" \
  --ee JUDGE_API_KEY="<JUDGE_API_KEY>"
```

> **Model prefix selects the thinking API format:**
> - `moonshot/<model>` — injects `thinking.type: enabled/disabled`
> - `openrouter/<model>` — injects `reasoning.effort: <level>`
> - `anthropic/<model>` — native Anthropic thinking API
> - `openai/<model>` — native OpenAI API
> - `custom/<model>` — no thinking parameter injection (any OpenAI-compatible endpoint)
>
> All prefixes except `anthropic` and `openai` accept `--ae CUSTOM_BASE_URL` / `--ae CUSTOM_API_KEY`.
> See [Running Tasks → Provider Routing](docs/en/guide/running-tasks.md#provider-routing-for-thinkingreasoning) for details.

See [docs/en/guide/getting-started.md](docs/en/guide/getting-started.md) for full setup details.

## Documentation

> New here? Start with **Getting Started**, then **Running Tasks**.

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/en/guide/getting-started.md) | Prerequisites, setup, first run |
| [Running Tasks](docs/en/guide/running-tasks.md) | Harbor CLI flags, results, full dataset runs |
| [Adding Tasks](docs/en/guide/adding-tasks.md) | Task format, scoring contract, submission |
| [Complexity Framework](docs/en/reference/complexity-framework.md) | Factor definitions, 134-case annotation table |
| [Task Format](docs/en/reference/task-format.md) | task.toml fields, evaluation rubric |

## Tasks (134 validated)

| Domain | Easy | Medium | Hard | Total |
|--------|------|--------|------|-------|
| E-commerce & Daily Svcs | 10 | 10 | 2 | 22 |
| Documents & Knowledge | 9 | 2 | 1 | 12 |
| Deep Research & Report | 4 | 9 | 4 | 17 |
| DevOps & Env Repair | 7 | 9 | 2 | 18 |
| Finance & Data Analytics | 8 | 5 | 0 | 13 |
| Coding & Software Dev | 5 | 3 | 2 | 10 |
| Health & Fitness | 2 | 7 | 2 | 11 |
| Social Media | 3 | 2 | 6 | 11 |
| Calendar & Task Mgmt | 2 | 5 | 3 | 10 |
| Communication & Email | 3 | 6 | 1 | 10 |
| **Total** | **53** | **58** | **23** | **134** |

Complexity factors: A1 Cross-Service Dependency (45), A2 Contaminated State (38), B1 Implicit Goals (43), B2 Knowledge Maintenance (17), C1 Runtime State Mutation (7), C2 Runtime Verification (6).

## Leaderboard

The public leaderboard is available at [mosi-ai.github.io/LiveClawBench](https://mosi-ai.github.io/LiveClawBench/).
Scores are Avg@3: mean of 3 independent runs per task, averaged across 134 v0.2.1 tasks and rescaled to [0, 100].
The corresponding [HuggingFace dataset](https://huggingface.co/datasets/Mosi-AI/LiveClawBench) includes 6,834 v0.2.1 trajectories in ATIF-v1.2 format, plus 630 earlier pilot trajectories.

| Rank | Model | Avg@3 |
|------|-------|-------|
| 1 | Kimi-K2.7-Code | 76.0 |
| 2 | GLM-5.1 | 74.7 |
| 3 | GPT-5.5 | 74.5 |
| 4 | GLM-5.2 | 72.9 |
| 5 | MiniMax-M3 | 71.4 |

Full leaderboard: [mosi-ai.github.io/LiveClawBench/leaderboard/](https://mosi-ai.github.io/LiveClawBench/leaderboard/).

Full per-factor and per-domain breakdowns, plus trajectory data, are available on
[HuggingFace](https://huggingface.co/datasets/Mosi-AI/LiveClawBench).

## Case Study

![Case Study: Flight Cancellation Claim](assets/LiveClawBench_case1.jpg)

**Task**: `flight-cancel-claim` (Hard · A1 + B1) — The agent must scan an inbox for a
flight cancellation notice, verify the cancellation, locate the compensation policy, collect
required information autonomously, and submit the claim email.

This case illustrates how **factor stacking** causes failures: agents that handle A1
(cross-service coordination) in isolation may still fail when B1 (implicit goal resolution)
is added, because they cannot infer what information to collect without being told explicitly.

## Vision & Roadmap

LiveClawBench is a living benchmark designed to evolve alongside the OpenClaw ecosystem.

### Infrastructure

- [x] 30-task pilot benchmark with manual validation (March 2026)
- [x] Automated evaluation harness for all 30 tasks (March 2026)
- [x] Public leaderboard with agent trajectories on HuggingFace (April 2026)
- [x] Expand to 134 tasks across 10 domains (June 2026)
- [x] Community task submission pipeline
- [ ] Support multiple harnesses, including CLI and Hermes

### Future Expansion

Add broader coverage for the existing complexity factors and domains:

- [ ] Add more tasks for underrepresented domain-factor combinations

### Stronger Diagnostics

- [x] Per-factor performance breakdown in leaderboard
- [ ] Cross-model statistical significance testing

### Contribute

We welcome contributions of new tasks, new domains, and new complexity dimensions.
Every new task expands the frontier of what we can measure about LLM agent capability.

- Browse the [Complexity Framework](docs/en/reference/complexity-framework.md) to find underrepresented areas
- Follow [Adding Tasks](docs/en/guide/adding-tasks.md) to build and validate your task
- Open a pull request — all contributions go through the same scoring-contract review

**Join us in building the most comprehensive evaluation of real-world LLM assistant capability.**

## Citation

```bibtex
@article{liveclawbench2026,
  title={LiveClawBench: Benchmarking LLM Agents on Complex, Real-World Assistant Tasks},
  author={Xiang Long and Li Du and Yilong Xu and Fangcheng Liu and Haoqing Wang and Ning Ding and Ziheng Li and Jianyuan Guo and Yehui Tang},
  journal={arXiv preprint},
  year={2026}
}
```
