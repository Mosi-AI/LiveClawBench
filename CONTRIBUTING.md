# Contributing to LiveClawBench

For the complete task contribution guide — directory layout, `task.toml` field reference,
`verify.py` contract, and known pitfalls — see **[docs/en/guide/adding-tasks.md](docs/en/guide/adding-tasks.md)**.

## Naming Convention

- Format: kebab-case (e.g., `flight-seat-selection`)
- Use a name that reflects the task's logical intent

## Validating

Before submitting, run:

```bash
python scripts/validate_tasks.py
```

The validator checks required files, kebab-case naming, TOML field completeness, `case_id` uniqueness, and stub detection.

## Submitting

1. Fork the repo and create a branch: `task/<task-name>`
2. Add your task directory under `tasks/`
3. Add an entry to `registry.json`
4. Add a row to `docs/metadata/cases_registry.csv` (English) and `docs/metadata/cases_registry_zh.csv` (Chinese)
5. Run `python scripts/validate_tasks.py` — all tasks must pass
6. Open a pull request with a brief description of the task
