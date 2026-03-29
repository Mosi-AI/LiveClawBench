"""Schema Validator - Validate columns exist, types match, and nullable constraints."""

import argparse
import json
import sys
import pandas as pd


def validate_schema(df, schema):
    """Validate a DataFrame against a schema definition.

    Schema format (JSON):
    {
        "columns": {
            "col_name": {"type": "int64", "nullable": false},
            "col_name2": {"type": "object", "nullable": true}
        },
        "required_columns": ["col_name", "col_name2"]
    }
    """
    errors = []

    # Check required columns exist
    required = schema.get("required_columns", [])
    for col in required:
        if col not in df.columns:
            errors.append(f"Missing required column: {col}")

    # Check column types and nullable constraints
    col_specs = schema.get("columns", {})
    for col, spec in col_specs.items():
        if col not in df.columns:
            continue

        expected_type = spec.get("type")
        if expected_type and str(df[col].dtype) != expected_type:
            errors.append(
                f"Column '{col}': expected type {expected_type}, got {df[col].dtype}"
            )

        nullable = spec.get("nullable", True)
        if not nullable and df[col].isnull().any():
            null_count = df[col].isnull().sum()
            errors.append(f"Column '{col}': has {null_count} nulls but nullable=false")

    return errors


def main():
    parser = argparse.ArgumentParser(description="Validate data against a schema")
    parser.add_argument("-i", "--input", required=True, help="Input parquet file")
    parser.add_argument(
        "-o", "--output", required=True, help="Output validation report (JSON)"
    )
    parser.add_argument(
        "-s", "--schema", required=True, help="Schema definition file (JSON)"
    )
    args = parser.parse_args()

    df = pd.read_parquet(args.input)
    with open(args.schema, "r") as f:
        schema = json.load(f)

    print(f"Validating: {args.input} ({len(df)} rows, {len(df.columns)} cols)")
    errors = validate_schema(df, schema)

    report = {
        "input": args.input,
        "rows": len(df),
        "columns": len(df.columns),
        "valid": len(errors) == 0,
        "error_count": len(errors),
        "errors": errors,
    }

    with open(args.output, "w") as f:
        json.dump(report, f, indent=2)

    status = "PASSED" if report["valid"] else "FAILED"
    print(f"Validation {status}: {len(errors)} error(s)")
    for err in errors:
        print(f"  - {err}")
    print(f"Report saved: {args.output}")

    if not report["valid"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
