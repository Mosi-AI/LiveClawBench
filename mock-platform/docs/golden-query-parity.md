# Shop Search: Golden-Query Parity Evidence

## Dataset

The product data file `sample_products.json` contains **91 products** across 1366 lines.
(AC-5.1's "1366 products" refers to the line count of the JSON file, not the product count.
Both Python and TypeScript implementations operate on the same 91-product array.)

## Method

**Both sides call the REAL production codepaths — no reimplementations.**

- **Python side**: Extracts the REAL `calculate_relevance_score()` function from
  `tasks/watch-shop/environment/shop-app/backend/app.py` via AST parsing
  (`ast.get_source_segment` + `exec`). The function runs with its original tokenization
  (`re.findall(r'\w+', text)`) and scoring logic. Zero code duplication.

- **TypeScript side**: Starts the Bun shop mock (`mocks/shop/src/index.tsx`) and calls
  the REAL `/api/products?q=...` HTTP endpoint. The endpoint internally runs
  `calculateRelevanceScore()` → `filterAndSortProducts()` → returns sorted results.
  The product ordering IS the relevance ranking. Zero code duplication.

Both scripts are reproducible: `docs/evidence/search-parity-test.py` and
`docs/evidence/search-parity-test.ts`.

## Golden Fixtures (from Implementation Plan AC-5.1)

### "smart watch" (9 results — MATCH)

| Rank | Product ID | Python Score | TS Rank | Match? |
|------|-----------|-------------|---------|--------|
| 1 | prod_0068 | 133.8 | 1 | EXACT |
| 2 | prod_0064 | 108.8 | 2 | EXACT |
| 3 | prod_0069 | 88.4 | 3 | EXACT |
| 4 | prod_0072 | 56.0 | 4 | EXACT |
| 5 | prod_0063 | 54.2 | 5 | EXACT |
| 6 | prod_0030 | 47.6 | 6 | EXACT |
| 7 | prod_0083 | 29.2 | 7 | EXACT |
| 8 | prod_0066 | 28.8 | 8 | EXACT |
| 9 | prod_0070 | 28.6 | 9 | EXACT |

### "washer" (10 results — MATCH)

| Rank | Product ID | Python Score | TS Rank | Match? |
|------|-----------|-------------|---------|--------|
| 1 | prod_0074 | 73.8 | 1 | EXACT |
| 2 | prod_0025 | 71.4 | 2 | EXACT |
| 3 | prod_0029 | 69.8 | 3 | EXACT |
| 4 | prod_0028 | 68.2 | 4 | EXACT |
| 5 | prod_0032 | 67.8 | 5 | EXACT |
| 6 | prod_0031 | 67.2 | 6 | EXACT |
| 7 | prod_0026 | 66.8 | 7 | EXACT |
| 8 | prod_0087 | 64.8 | 8 | EXACT |
| 9 | prod_0027 | 62.8 | 9 | EXACT |
| 10 | prod_0030 | 62.6 | 10 | EXACT |

### "toilet paper" (10 results — MATCH)

| Rank | Product ID | Python Score | TS Rank | Match? |
|------|-----------|-------------|---------|--------|
| 1 | prod_0022 | 109.4 | 1 | EXACT |
| 2 | prod_0017 | 109.0 | 2 | EXACT |
| 3 | prod_0084 | 104.4 | 3 | EXACT |
| 4 | prod_0021 | 104.2 | 4 | EXACT |
| 5 | prod_0019 | 102.4 | 5 | EXACT |
| 6 | prod_0024 | 99.8 | 6 | EXACT |
| 7 | prod_0018 | 98.6 | 7 | EXACT |
| 8 | prod_0020 | 98.6 | 8 | EXACT |
| 9 | prod_0023 | 92.2 | 9 | EXACT |
| 10 | prod_0082 | 52.2 | 10 | EXACT |

### "stapler" (9 results — MATCH)

| Rank | Product ID | Python Score | TS Rank | Match? |
|------|-----------|-------------|---------|--------|
| 1 | prod_0009 | 88.0 | 1 | EXACT |
| 2 | prod_0013 | 86.0 | 2 | EXACT |
| 3 | prod_0010 | 80.8 | 3 | EXACT |
| 4 | prod_0015 | 77.2 | 4 | EXACT |
| 5 | prod_0012 | 73.0 | 5 | EXACT |
| 6 | prod_0014 | 72.4 | 6 | EXACT |
| 7 | prod_0088 | 72.4 | 7 | EXACT |
| 8 | prod_0011 | 70.2 | 8 | EXACT |
| 9 | prod_0016 | 66.2 | 9 | EXACT |

## Summary

| Query | Python Count | TS Count | Rankings Match |
|-------|-------------|----------|---------------|
| smart watch | 9 | 9 | YES |
| washer | 10 | 10 | YES |
| toilet paper | 10 | 10 | YES |
| stapler | 9 | 9 | YES |

**Result: 4/4 golden fixtures produce identical result counts and rankings (38/38 IDs match).**

**Python evidence**: Real `calculate_relevance_score()` from `app.py` via AST extraction.
**TypeScript evidence**: Real `/api/products` endpoint from running Bun shop mock.

## Reproduction

Both test scripts are in `mock-platform/docs/evidence/`:

```bash
# Python test (from repo root) — extracts REAL function from app.py via AST
python3 mock-platform/docs/evidence/search-parity-test.py > docs/evidence/python-results.json

# TypeScript test (from mock-platform/) — calls REAL /api/products HTTP endpoint
cd mock-platform && bun run docs/evidence/search-parity-test.ts > docs/evidence/typescript-results.json
```

Raw result files: `mock-platform/docs/evidence/python-results.json`, `mock-platform/docs/evidence/typescript-results.json`.
