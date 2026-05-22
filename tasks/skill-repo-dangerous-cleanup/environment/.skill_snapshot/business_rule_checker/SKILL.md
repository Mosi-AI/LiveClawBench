---
name: business-rule-checker
description: Validate tabular data against configurable business rules — range checks, cross-column constraints, referential integrity against lookup tables, and temporal consistency.
version: 0.3.0
---

# Business Rule Checker

## Skill Summary

Validates dataset records against a set of business logic rules. Goes beyond schema validation to check domain-specific constraints: numeric range checks (e.g., price > 0), cross-column consistency (e.g., end_date >= start_date), referential integrity against external lookup tables (e.g., product_id must exist in product catalog), and temporal range validation (e.g., date within fiscal quarter). Records that fail rules are flagged or rejected.

## Rule Types
- **range**: Numeric column must be within `[min, max]`
- **positive**: Numeric column must be > 0
- **reference**: Column value must exist in a lookup table/file
- **cross-column**: Expression involving multiple columns must evaluate to true
- **date-range**: Date column must fall within `[start, end]`
- **regex**: String column must match a pattern

## Inputs
- `--input` / `-i`: Path to dataset (CSV or Parquet) (required)
- `--rules` / `-r`: Path to rules config file (JSON or YAML)
- `--lookup-dir`: Directory containing lookup tables for referential checks
- `--output` / `-o`: Output directory
- `--reject-action`: What to do with failing rows: `flag`, `reject`, or `separate` (default: `flag`)

## Rules Config Example
```json
{
  "rules": [
    {"name": "positive_price", "type": "positive", "column": "unit_price"},
    {"name": "positive_qty", "type": "positive", "column": "quantity"},
    {"name": "valid_product", "type": "reference", "column": "product_id", "lookup": "product_catalog.json", "lookup_key": "id"},
    {"name": "date_in_quarter", "type": "date-range", "column": "date", "min": "2024-01-01", "max": "2024-03-31"}
  ]
}
```

## Processing Steps
1. Load dataset and rules configuration
2. Load any referenced lookup tables
3. Apply each rule to every record
4. Collect violations per rule and per row
5. Apply reject-action (flag columns, separate files, or reject)
6. Generate validation results

## Output
- `valid_records.csv`: Records passing all rules
- `rejected_records.json`: Records failing rules with violation details
- `rule_summary.json`: Per-rule pass/fail counts and percentages
- Console: Summary of rules applied and violation counts

## Implementation
- Command: `python3 ./skills/business_rule_checker/checker.py -i <file> -r <rules> -o <output_dir>`
- Dependencies: `pandas`, `numpy`
