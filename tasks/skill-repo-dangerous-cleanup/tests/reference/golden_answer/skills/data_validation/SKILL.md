---
name: data-validation
description: Validate tabular data against JSON schemas and configurable business rules — column presence, type checks, nullable/unique constraints, range rules, referential integrity against lookup tables, and temporal consistency.
version: 1.0.0
---

# Data Validation

## Skill Summary

Validates dataset records against both structural schema definitions and domain-specific business rules. Checks column presence, data types, nullable/unique constraints, regex patterns (schema layer), plus numeric range checks, cross-column constraints, referential integrity against external catalog/lookup tables, and date range validation (business rule layer). Records failing validation are flagged, rejected, or separated.

Merges functionality from: `schema_validator`, `business_rule_checker`.

## Validation Layers

### Schema Validation
- **Required columns**: All declared columns must exist
- **Type checking**: Values must match declared type (string, int, float, date, bool)
- **Nullable constraints**: Non-nullable columns must have zero nulls
- **Uniqueness**: Unique columns must have no duplicate values
- **Pattern matching**: String values must match declared regex
- **Strict mode**: Flag extra columns not in schema

### Business Rule Validation
- **Range checks**: Numeric columns within `[min, max]` or `> 0`
- **Cross-column constraints**: Expressions involving multiple columns (e.g., `end_date >= start_date`)
- **Referential integrity**: Column values must exist in external lookup table (e.g., `product_id` in product catalog)
- **Date range**: Date columns within expected fiscal period
- **Custom regex**: String columns matching business patterns

## Inputs
- `--input` / `-i`: Path to dataset (CSV or Parquet) (required)
- `--schema` / `-s`: Path to JSON schema file
- `--rules` / `-r`: Path to business rules config (JSON or YAML)
- `--lookup-dir`: Directory containing lookup tables for referential checks
- `--output` / `-o`: Output directory
- `--reject-action`: `flag`, `reject`, or `separate` (default: `flag`)
- `--strict`: Fail on extra columns beyond schema
- `--max-errors`: Stop after N errors (default: unlimited)

## Output
- `valid_records.csv`: Records passing all checks
- `rejected_records.json`: Failed records with violation details and reasons
- `validation_report.json`: Overall pass/fail, per-column results, per-rule counts
- `rule_summary.json`: Per-rule pass/fail percentages

## Implementation
- Command: `python3 ./skills/data_validation/validate.py -i <file> -s <schema> -r <rules> -o <output_dir>`
- Dependencies: `pandas`, `numpy`, `jsonschema`
