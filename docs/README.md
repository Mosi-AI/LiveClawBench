# LiveClawBench Documentation

LiveClawBench: Benchmarking LLM Agents on Complex, Real-World Assistant Tasks.

## Guides

Step-by-step operational documentation for running and contributing to the benchmark:

| Guide | Description |
|-------|-------------|
| [Getting Started](guide/getting-started.md) | Prerequisites, `setup.sh`, `.env` configuration, smoke test |
| [Running Tasks](guide/running-tasks.md) | Harbor CLI flags, API key injection, results, full dataset runs |
| [Adding Tasks](guide/adding-tasks.md) | Task format, scoring contract, validation, submission checklist |

## Reference

Technical reference for task format and complexity annotations:

| Reference | Description |
|-----------|-------------|
| [Complexity Framework](reference/complexity-framework.md) | Factor definitions, 29-case annotation table, domain heatmap, controlled pairs |
| [Task Format](reference/task-format.md) | Harbor task directory structure, `task.toml` fields, evaluation rubric |
| [Jobs Output](reference/jobs-output.md) | `harbor run -o jobs` directory layout, file lifecycle (bind mounts), key fields, troubleshooting |

## Metadata

| File | Description |
|------|-------------|
| [cases_registry.csv](metadata/cases_registry.csv) | Single source of truth for all case metadata |
