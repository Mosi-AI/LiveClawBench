---
name: schema-validator
description: Validate tabular data against a predefined JSON schema — checks column presence, data types, nullable constraints, and unique constraints.
version: 0.6.0
---

# Schema Validator

## Skill Summary

Validates a tabular dataset against a user-defined JSON schema. Checks that all required columns are present, column data types match expectations, nullable constraints are respected, and unique constraints hold. Produces a structured validation report indicating pass/fail for each rule, with row-level error details.

## Schema Definition Format
```json
{
  "columns": {
    "column_name": {
      "type": "string|int|float|date|bool",
      "nullable": false,
      "unique": false,
      "pattern": "regex (for string columns)"
    }
  },
  "required_columns": ["col1", "col2"]
}
```

## Inputs
- `--input` / `-i`: Path to dataset file (CSV or Parquet) (required)
- `--schema` / `-s`: Path to JSON schema file (required)
- `--output` / `-o`: Output path for validation report
- `--strict`: Fail if extra columns exist beyond schema (default: false)
- `--max-errors`: Stop after N errors (default: unlimited)

## Validation Checks
1. **Required columns**: All columns listed in `required_columns` must exist
2. **Type checking**: Each column value must match declared type
3. **Nullable**: Non-nullable columns must have zero null values
4. **Uniqueness**: Unique columns must have no duplicate values
5. **Pattern matching**: String values must match declared regex pattern
6. **Extra columns**: In strict mode, flag columns not in schema

## Output
- `validation_report.json`: Structured report with:
  - Overall pass/fail status
  - Per-column validation results
  - Row-level error details (row index, column, expected vs actual)
  - Error counts by type

## Implementation
- Command: `python3 ./skills/schema_validator/validate.py -i <file> -s <schema>`
- Dependencies: `pandas`, `jsonschema`
