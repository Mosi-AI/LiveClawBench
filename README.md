# LiveClawBench

> Benchmarking LLM Agents on Complex, Real-World Assistant Tasks

[![Paper](https://img.shields.io/badge/Paper-Preprint-orange)](https://github.com/Mosi-AI/LiveClawBench/releases/download/v0.1-preprint/LiveClawBench.pdf)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Tasks](https://img.shields.io/badge/Tasks-30-green)](tasks/)

LiveClawBench evaluates LLM agents on realistic, multi-step assistant tasks using the [Harbor](https://github.com/Mosi-AI/claw-harbor) framework and the [OpenClaw](https://github.com/openclaw/openclaw) agent platform.

## Overview

![LiveClawBench Overview](assets/LiveClawBench_Overview.jpg)

LLM agents are increasingly expected to handle real-world assistant tasks, yet existing
benchmarks evaluate them under isolated difficulty sources. LiveClawBench addresses this
by introducing a **Triple-Axis Complexity Framework** derived from empirical analysis of
production OpenClaw usage data, and building a pilot benchmark with explicit factor
annotations, controlled pairs, deterministic mock environments, and outcome-driven evaluation.

> **Status** (updated March 21, 2026): The 29 pilot tasks were manually constructed and validated by contributors.
> Automated evaluation harness standardization is in progress — full automated testing support expected **week of March 24**.
> Leaderboard, agent trajectories, and an updated preprint will follow **week of March 31**.

**Paper**: [LiveClawBench: Benchmarking LLM Agents on Complex, Real-World Assistant Tasks](https://github.com/Mosi-AI/LiveClawBench/releases/download/v0.1-preprint/LiveClawBench.pdf) — arXiv preprint (submission in progress)

## Triple-Axis Complexity Framework

Task difficulty is characterized along three orthogonal axes. The pilot benchmark covers
A1, A2, B1, B2; axes A3, A4, B3, C1, C2 are on the expansion roadmap.

| Factor | Axis | Description | In Pilot |
|--------|------|-------------|----------|
| **A1** Cross-Service Dependency | Environment | Coordinate multiple services in a single workflow | ✓ 10 tasks |
| **A2** Contaminated Initial State | Environment | Diagnose and repair corrupted environments before acting | ✓ 6 tasks |
| A3 Temporal & Resource Constraints | Environment | Reason under deadlines or rate limits | — planned |
| A4 Cross-Modal Interaction | Environment | Extract and integrate information across non-text modalities (images, PDFs, CAPTCHAs) | — planned |
| **B1** Implicit Goal Resolution | Cognitive | Infer missing preconditions; seek clarification when ambiguous | ✓ 4 tasks |
| **B2** Knowledge System Maintenance | Cognitive | Create, update, and repair persistent skill/knowledge artifacts | ✓ 11 tasks |
| B3 Multi-Agent Delegation | Cognitive | Orchestrate specialized sub-agents and synthesize results | — planned |
| C1 Environmental State Invalidation | Runtime | Replan when mid-execution environment changes invalidate established assumptions | — planned |
| C2 Outcome Verification under Altered State | Runtime | Actively verify task success when no simple pass/fail signal is available | — planned |

**Controlled pairs** allow direct factor attribution: each pair shares the same core logic
but differs in exactly one complexity factor, enabling causal analysis of agent degradation.

## Quick Start

```bash
git clone https://github.com/Mosi-AI/LiveClawBench.git
cd LiveClawBench
./setup.sh          # installs harbor CLI, creates .env from template

# Build the shared base image (required once before running any task)
docker build -t liveclawbench-base:latest docker/base/

# Edit .env with your API key, then run a task:
source .venv/bin/activate
harbor run -p tasks/watch-shop -a openclaw -m custom/<YOUR_MODEL_ID> \
  -n 1 -o jobs \
  --ae CUSTOM_BASE_URL="<YOUR_BASE_URL>" \
  --ae CUSTOM_API_KEY="<YOUR_API_KEY>"
```

See [docs/guide/getting-started.md](docs/guide/getting-started.md) for full setup details.

## Documentation

> New here? Start with **Getting Started**, then **Running Tasks**.

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/guide/getting-started.md) | Prerequisites, setup, first run |
| [Running Tasks](docs/guide/running-tasks.md) | Harbor CLI flags, results, full dataset runs |
| [Adding Tasks](docs/guide/adding-tasks.md) | Task format, scoring contract, submission |
| [Complexity Framework](docs/reference/complexity-framework.md) | Factor definitions, 30-case annotation table |
| [Task Format](docs/reference/task-format.md) | task.toml fields, evaluation rubric |

## Tasks (30 pilot)

| Domain | Easy | Medium | Hard |
|--------|------|--------|------|
| E-commerce & Daily Svcs | 5 | 4 | 2 |
| Communication & Email | 2 | — | — |
| Calendar & Task Mgmt | — | — | 2 |
| Coding & Software Dev | — | 1 | 1 |
| DevOps & Env Repair | 1 | — | 1 |
| Documents & Knowledge | 2 | 4 | 3 |
| Deep Research & Report | — | 1 | 1 |
| **Total** | **10** | **10** | **10** |

Complexity factors: A1 Cross-Service Dependency (10), A2 Contaminated State (6), B1 Implicit Goals (4), B2 Knowledge Maintenance (11).

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

- [x] 29-task pilot benchmark with manual validation (March 2026)
- [ ] Automated evaluation harness for all 29 tasks (week of March 24)
- [ ] Public leaderboard with agent trajectory viewer (week of March 31)
- [ ] Community task submission pipeline

### Broader Domains

Expand from 7 to 15+ domains:

- [ ] Finance & banking workflows
- [ ] Healthcare & scheduling scenarios
- [ ] Travel & logistics (beyond flight booking)
- [ ] Home & smart device management

### Fuller Complexity Coverage

Axes A3, A4, B3, C1–C2 are not yet in the pilot:

- [ ] A3: Temporal & Resource Constraints (deadline reasoning, rate-limit handling)
- [ ] A4: Cross-Modal Interaction (images, PDFs, CAPTCHAs — requires vision-capable model)
- [ ] B3: Multi-Agent Delegation (orchestrator/sub-agent patterns)
- [ ] C1: Environmental State Invalidation (mid-execution environment changes invalidate agent assumptions)
- [ ] C2: Outcome Verification under Altered State (active verification without simple pass/fail signal)

### Stronger Diagnostics

- [ ] Scale controlled pairs from 5 to 20+ for robust factor-level attribution
- [ ] Per-factor performance breakdown in leaderboard
- [ ] Cross-model statistical significance testing

### Contribute

We welcome contributions of new tasks, new domains, and new complexity dimensions.
Every new task expands the frontier of what we can measure about LLM agent capability.

- Browse the [Complexity Framework](docs/reference/complexity-framework.md) to find underrepresented areas
- Follow [Adding Tasks](docs/guide/adding-tasks.md) to build and validate your task
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
