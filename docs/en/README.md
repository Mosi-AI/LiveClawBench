# LiveClawBench Documentation

LiveClawBench: Benchmarking LLM Agents on Complex, Real-World Assistant Tasks.

> [中文文档](../zh/README.md)

## Guides

Step-by-step operational documentation for running and contributing to the benchmark:

| Guide | Description |
|-------|-------------|
| [Getting Started](guide/getting-started.md) | Prerequisites, `setup.sh`, `.env` configuration, smoke test |
| [Running Tasks](guide/running-tasks.md) | Harbor CLI flags, API key injection, **`--dataset` with `--registry-path`**, per-task loop, results, metrics collection |
| [Adding Tasks](guide/adding-tasks.md) | Task format, scoring contract, validation, submission checklist |

## Reference

Technical reference for task format and complexity annotations:

| Reference | Description |
|-----------|-------------|
| [Complexity Framework](reference/complexity-framework.md) | Factor definitions, 30-case annotation table, domain heatmap, controlled pairs |
| [Task Format](reference/task-format.md) | Harbor task directory structure, `task.toml` fields, evaluation rubric |
| [Jobs Output](reference/jobs-output.md) | `harbor run -o jobs` directory layout, file lifecycle (bind mounts), key fields, troubleshooting |

## Background & Roadmap

| Document | Description |
|----------|-------------|
| [What Makes Real Assistant Tasks Hard?](background/assistant_task_complexity.md) | Factor stacking effect, benchmark comparison, why this framework matters |
| [Future Factors](roadmap/future_factors.md) | A3/A4/B3/C-axis expansion roadmap with priority order |

## Metadata

| File | Description |
|------|-------------|
| [cases_registry.csv](../../metadata/cases_registry.csv) | Single source of truth for all case metadata (English) |
