---
name: sales-data-pipeline
description: End-to-end ETL pipeline for retail sales data — ingests multi-format transaction files, cleans and validates data, computes derived financial metrics, aggregates across dimensions, and exports results with summary reports.
version: 0.9.0
---

# Sales Data Pipeline

## Skill Summary

A comprehensive ETL (Extract-Transform-Load) pipeline for processing retail sales transaction data.
The pipeline handles the full lifecycle from raw file ingestion through to final report generation.

The pipeline is implemented across 14 sub-modules, each handling a specific aspect of the
data processing workflow. See the sub-directories below for the current implementation.

## Sub-Modules

| Directory                   | Script         | Stage              | Description                                          |
| --------------------------- | -------------- | ------------------ | ---------------------------------------------------- |
| `csv_data_loader/`          | `loader.py`    | Ingestion          | Load CSV files with delimiter/encoding options       |
| `excel_data_reader/`        | `reader.py`    | Ingestion          | Read Excel workbooks with sheet selection            |
| `data_ingestion_service/`   | `ingest.py`    | Ingestion          | Universal loader (CSV/Excel/JSON/Parquet)            |
| `null_value_processor/`     | `processor.py` | Cleaning           | Handle null/missing values                           |
| `data_deduplicator/`        | `dedup.py`     | Cleaning           | Remove duplicate records                             |
| `data_cleaning_toolkit/`    | `clean.py`     | Cleaning           | Combined cleaning (nulls + dedup + outliers + types) |
| `schema_validator/`         | `validate.py`  | Validation         | Schema-based column/type validation                  |
| `business_rule_checker/`    | `checker.py`   | Validation         | Business rule validation (ranges, referential)       |
| `numeric_normalizer/`       | `normalize.py` | Transformation     | Min-max / z-score / robust scaling                   |
| `feature_calculator/`       | `calculate.py` | Transformation     | Revenue, margin, time features, moving averages      |
| `data_aggregator/`          | `aggregate.py` | Aggregation        | Group-by aggregation with configurable metrics       |
| `summary_report_generator/` | `report.py`    | Aggregation/Report | KPI report: revenue, top products, trends            |
| `csv_export_writer/`        | `export.py`    | Export             | CSV export with formatting options                   |
| `multi_format_exporter/`    | `export.py`    | Export             | Multi-format export (CSV/JSON/Parquet/Excel)         |

## Pipeline Flow

```
Raw Files ──► Ingestion ──► Cleaning ──► Validation ──► Transformation ──► Aggregation ──► Export
  (CSV/       (3 modules)  (3 modules)  (2 modules)    (2 modules)       (2 modules)    (2 modules)
   Excel/
   JSON)
```

## Inputs

- `--input-csv` / `-i`: Path to raw transaction CSV file(s), supports glob
- `--catalog` / `-c`: Path to product catalog JSON
- `--output-dir` / `-o`: Output directory for all generated files
- `--date-range`: Optional date filter (`YYYY-MM-DD:YYYY-MM-DD`)

## Output Files

- `cleaned_transactions.csv` — Validated, cleaned transaction records
- `rejected_records.json` — Records that failed validation with reasons
- `agg_daily.csv`, `agg_weekly.csv`, `agg_monthly.csv` — Time aggregations
- `agg_by_product.csv`, `agg_by_region.csv` — Dimension aggregations
- `summary_report.json` — KPI summary report

## Implementation

Each sub-module can be invoked independently via its own script:

```bash
# Example: run the full pipeline manually
python3 data_ingestion_service/ingest.py -i raw_sales.csv -o /tmp/stage1/
python3 data_cleaning_toolkit/clean.py -i /tmp/stage1/output.parquet -o /tmp/stage2/
python3 schema_validator/validate.py -i /tmp/stage2/cleaned.csv -s schema.json -o /tmp/stage3/
python3 feature_calculator/calculate.py -i /tmp/stage3/valid.csv -o /tmp/stage4/
python3 data_aggregator/aggregate.py -i /tmp/stage4/enriched.csv -g region -o /tmp/stage5/
python3 multi_format_exporter/export.py -i /tmp/stage5/aggregated.csv -o /tmp/final/ -f csv,json
```

Dependencies: `pandas`, `numpy`, `openpyxl`, `xlrd`, `chardet`, `pyarrow`
