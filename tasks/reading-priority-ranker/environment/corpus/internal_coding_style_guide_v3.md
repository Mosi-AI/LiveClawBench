# Internal Coding Style Guide — Version 3.0

**Maintained by:** Engineering Enablement Team  
**Last Updated:** 2026-04-01  
**Status:** Active — supersedes v2.x

## Overview

This guide defines Mosi's internal coding conventions for Python, TypeScript, and SQL.
All new code should follow these standards. Legacy code should be migrated opportunistically.

## Python

- Use `ruff` for formatting and linting (replaces `black` + `flake8`).
- Type annotations required for all public functions and class methods.
- Prefer `pathlib.Path` over `os.path` for filesystem operations.
- Use `logging` module; never `print()` in production code.

## TypeScript

- Use ESLint with the shared `@mosi/eslint-config` preset.
- Strict mode enabled (`strict: true` in tsconfig).
- Prefer `const` over `let`; avoid `var`.
- Named exports preferred over default exports for library code.

## SQL (dbt / BigQuery)

- All dbt models must include a YAML description and at least one `not_null` test.
- Use CTEs for readability; avoid nested subqueries deeper than 2 levels.
- Column names: `snake_case`; table names: `snake_case`.
- Partition and cluster keys must be reviewed by data engineering before merging.

## Review Process

PRs modifying more than 200 lines require two reviewers.  
Automated checks (ruff, ESLint, dbt tests) must pass before merge.

Read when you have time; no immediate action required.
