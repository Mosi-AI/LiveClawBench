---
name: numeric-normalizer
description: Normalize and scale numeric columns using min-max scaling, z-score standardization, or robust scaling. Supports saving and applying scaler parameters for consistent train/test normalization.
version: 0.2.3
---

# Numeric Normalizer

## Skill Summary

Applies numeric normalization/scaling transformations to specified columns in a tabular dataset. Supports min-max scaling (0-1 range), z-score standardization (mean=0, std=1), and robust scaling (median-centered, IQR-scaled). Can save fitted scaler parameters to a JSON file for later re-application to new data (useful for ML train/test consistency).

## Scaling Methods
- **min-max**: `x_scaled = (x - min) / (max - min)` → range [0, 1]
- **z-score**: `x_scaled = (x - mean) / std` → mean 0, std 1
- **robust**: `x_scaled = (x - median) / IQR` → robust to outliers
- **log**: `x_scaled = log(x + 1)` → for right-skewed distributions
- **max-abs**: `x_scaled = x / max(|x|)` → range [-1, 1]

## Inputs
- `--input` / `-i`: Path to input file (CSV or Parquet) (required)
- `--columns` / `-c`: Numeric columns to normalize (comma-separated; default: all numeric)
- `--method` / `-m`: Normalization method (default: `min-max`)
- `--output` / `-o`: Output file path
- `--save-params`: Save scaler parameters to JSON file
- `--load-params`: Load previously saved parameters (transform-only mode)

## Processing Steps
1. Load dataset and identify target columns
2. Compute scaling parameters (min/max, mean/std, or median/IQR)
3. Apply transformation to each target column
4. Optionally save parameters for reproducibility
5. Save normalized dataset

## Output
- Normalized dataset (CSV or Parquet)
- `scaler_params.json` (optional): Fitted parameters per column
- Console: Per-column stats before/after normalization

## Implementation
- Command: `python3 ./skills/numeric_normalizer/normalize.py -i <file> -o <output> -m <method>`
- Dependencies: `pandas`, `numpy`, `scikit-learn`
