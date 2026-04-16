# Shop Search: Golden-Query Parity Evidence (AC-5.1)

## Dataset

The product data file `sample_products.json` contains **91 products**.
Both Python and TypeScript implementations operate on the same 91-product array.

## Method

**Both sides call the REAL production search/filter functions — no reimplementations.**

- **Python side**: Extracts the REAL `calculate_relevance_score()`, `search_products()`,
  AND `filter_and_sort_products()` from `tasks/watch-shop/environment/shop-app/backend/app.py`
  via AST parsing (`ast.get_source_segment` + `exec`). The harness calls `search_products()`
  (which applies threshold + sort) and `filter_and_sort_products()` (which applies the full
  search → filter → sort pipeline). Per-product scores are obtained directly from the real
  `calculate_relevance_score()`. Zero code duplication; zero reimplementation of thresholding,
  fallback, or sort behavior.

- **TypeScript side**: Directly imports the REAL `calculateRelevanceScore()`,
  `searchProducts()`, and `filterAndSortProducts()` from
  `mocks/shop/src/search-algorithm.ts` (the single source of truth for the Bun search
  algorithm). This module is also imported by `index.tsx` (the production shop service),
  making `search-algorithm.ts` the shared codepath for both the test and production.
  No HTTP server startup, no source patching. Per-product scores come from the
  real function. The filter flow calls `filterAndSortProducts()` with `{ query }` to exercise
  the full production pipeline.

Both scripts are reproducible: `docs/evidence/search-parity-test.py` and
`docs/evidence/search-parity-test.ts`.

## Score Parity Results

**38 per-product scores compared across 4 queries — ALL match within epsilon (<0.01).**

| Query | Scored Products | Score Parity | Filter IDs Match |
|-------|----------------|-------------|-----------------|
| smart watch | 9 | 9/9 EXACT | YES (9/9) |
| washer | 10 | 10/10 EXACT | YES (10/10) |
| toilet paper | 10 | 10/10 EXACT | YES (10/10) |
| stapler | 9 | 9/9 EXACT | YES (9/9) |

**Total: 38/38 scores match, 38/38 filter_and_sort IDs match.**

### "smart watch" — Per-Product Score Comparison

| Rank | Product ID | Python Score | TS Score | Match? |
|------|-----------|-------------|---------|--------|
| 1 | prod_0068 | 133.8 | 133.8 | EXACT |
| 2 | prod_0064 | 108.8 | 108.8 | EXACT |
| 3 | prod_0069 | 88.4 | 88.4 | EXACT |
| 4 | prod_0072 | 56.0 | 56.0 | EXACT |
| 5 | prod_0063 | 54.2 | 54.2 | EXACT |
| 6 | prod_0030 | 47.6 | 47.6 | EXACT |
| 7 | prod_0083 | 29.2 | 29.2 | EXACT |
| 8 | prod_0066 | 28.8 | 28.8 | EXACT |
| 9 | prod_0070 | 28.6 | 28.6 | EXACT |

### "washer" — Per-Product Score Comparison

| Rank | Product ID | Python Score | TS Score | Match? |
|------|-----------|-------------|---------|--------|
| 1 | prod_0074 | 73.8 | 73.8 | EXACT |
| 2 | prod_0025 | 71.4 | 71.4 | EXACT |
| 3 | prod_0029 | 69.8 | 69.8 | EXACT |
| 4 | prod_0028 | 68.2 | 68.2 | EXACT |
| 5 | prod_0032 | 67.8 | 67.8 | EXACT |
| 6 | prod_0031 | 67.2 | 67.2 | EXACT |
| 7 | prod_0026 | 66.8 | 66.8 | EXACT |
| 8 | prod_0087 | 64.8 | 64.8 | EXACT |
| 9 | prod_0027 | 62.8 | 62.8 | EXACT |
| 10 | prod_0030 | 62.6 | 62.6 | EXACT |

### "toilet paper" — Per-Product Score Comparison

| Rank | Product ID | Python Score | TS Score | Match? |
|------|-----------|-------------|---------|--------|
| 1 | prod_0022 | 109.4 | 109.4 | EXACT |
| 2 | prod_0017 | 109.0 | 109.0 | EXACT |
| 3 | prod_0084 | 104.4 | 104.4 | EXACT |
| 4 | prod_0021 | 104.2 | 104.2 | EXACT |
| 5 | prod_0019 | 102.4 | 102.4 | EXACT |
| 6 | prod_0024 | 99.8 | 99.8 | EXACT |
| 7 | prod_0018 | 98.6 | 98.6 | EXACT |
| 8 | prod_0020 | 98.6 | 98.6 | EXACT |
| 9 | prod_0023 | 92.2 | 92.2 | EXACT |
| 10 | prod_0082 | 52.2 | 52.2 | EXACT |

### "stapler" — Per-Product Score Comparison

| Rank | Product ID | Python Score | TS Score | Match? |
|------|-----------|-------------|---------|--------|
| 1 | prod_0009 | 88.0 | 88.0 | EXACT |
| 2 | prod_0013 | 86.0 | 86.0 | EXACT |
| 3 | prod_0010 | 80.8 | 80.8 | EXACT |
| 4 | prod_0015 | 77.2 | 77.2 | EXACT |
| 5 | prod_0012 | 73.0 | 73.0 | EXACT |
| 6 | prod_0014 | 72.4 | 72.4 | EXACT |
| 7 | prod_0088 | 72.4 | 72.4 | EXACT |
| 8 | prod_0011 | 70.2 | 70.2 | EXACT |
| 9 | prod_0016 | 66.2 | 66.2 | EXACT |

## Production Codepath Verification

`search-algorithm.ts` is the single source of truth (SSOT) for the search algorithm:

- **Production codepath**: `index.tsx` imports `calculateRelevanceScore`, `searchProducts`,
  `filterAndSortProducts`, and `FilterOptions` from `./search-algorithm.js`. No inline
  duplicate search functions remain in `index.tsx`.
- **Test codepath**: `search-parity-test.ts` imports the same functions from
  `search-algorithm.ts`.
- Both paths resolve to the **same module at runtime** — parity tests exercise the
  production codepath, not a separate test copy.

### Runtime HTTP Endpoint Verification

The running shop service (via `bun run`) was verified against the same golden queries:

| Query | Top Result (API) | Matches Filter ID #1? |
|-------|-----------------|----------------------|
| smart watch | prod_0068 (score 133.8) | YES |
| washer | prod_0074 (score 73.8) | YES |
| toilet paper | prod_0022 (score 109.4) | YES |
| stapler | prod_0009 (score 88.0) | YES |

Method: `bun run mocks/shop/src/index.tsx` with source-path patching for local
products.json, then `curl /api/products?q=<query>` and compare top result ID with
`filter_and_sort_ids[0]` from the parity test.

## TS Production Behavior: Zero-Result Fallback

When `filterAndSortProducts()` returns zero results with the default threshold
(`minRelevance=10.0`), the TypeScript implementation retries with `minRelevance=0.0`
using the full source product set (`sourceProducts` parameter). This is documented
as an **intentional divergence** from the Python implementation:

| Implementation | Fallback Variable | Behavior |
|---------------|-------------------|----------|
| Python `app.py:449` | `products` (empty from first call) | BUG: retries empty list |
| TS `search-algorithm.ts:162` | `sourceProducts` (parameter) | Correct: retries full set |

When `index.tsx` calls `filterAndSortProducts(allProducts, opts)`, the
`sourceProducts` parameter receives `allProducts`, so the TS fallback correctly
retries the full dataset. The Python bug is a known divergence — the TS behavior
is correct and should not be "fixed" to match the Python bug.

This fallback behavior is NOT included in the 38/38 parity count above because
the parity test uses matching datasets with sufficient results for all 4 queries.

## Reproduction

Both test scripts are in `mock-platform/docs/evidence/`:

```bash
# Python test (from repo root) — extracts REAL functions from app.py via AST
python3 mock-platform/docs/evidence/search-parity-test.py > docs/evidence/python-results.json

# TypeScript test (from mock-platform/) — directly imports REAL functions from search-algorithm.ts
cd mock-platform && bun run docs/evidence/search-parity-test.ts > docs/evidence/typescript-results.json
```

Raw result files: `mock-platform/docs/evidence/python-results.json`, `mock-platform/docs/evidence/typescript-results.json`.
