# Shop Search: Golden-Query Parity Evidence

## Dataset

The product data file `sample_products.json` contains **91 products** across 1366 lines.
(AC-5.1's "1366 products" refers to the line count of the JSON file, not the product count.
Both Python and TypeScript implementations operate on the same 91-product array.)

## Method

Ran the **identical** `calculateRelevanceScore()` algorithm in both Python (FastAPI original)
and TypeScript (Bun+Hono port) against the **full 91-product dataset** from
`tasks/watch-shop/environment/shop-app/frontend/data/sample_products.json`.

Both implementations use the same scoring factors:
1. Exact title match (100 pts)
2. Exact word matches + position bonus (20 + max(0, 10 - pos))
3. Partial word/substring matches (10 pts, 3+ chars only)
4. Query coverage (30 * coverage ratio)
5. Word frequency boost (min(freq * 5, 20))
6. Product quality: rating * 2, best_seller +15, overall_pick +15

Minimum relevance threshold: 10.0 (with fallback to 0.0 if no results).

## Golden Fixtures (from Implementation Plan AC-5.1)

### "smart watch" (9 results — MATCH)

| Rank | Product ID | Score | Match? |
|------|-----------|-------|--------|
| 1 | prod_0068 | 119.8 | EXACT |
| 2 | prod_0064 | 108.8 | EXACT |
| 3 | prod_0069 | 88.4 | EXACT |
| 4 | prod_0083 | 59.2 | EXACT |
| 5 | prod_0066 | 58.8 | EXACT |
| 6 | prod_0070 | 58.6 | EXACT |
| 7 | prod_0072 | 55.0 | EXACT |
| 8 | prod_0063 | 54.2 | EXACT |
| 9 | prod_0030 | 47.6 | EXACT |

### "washer" (10 results — MATCH)

| Rank | Product ID | Score | Match? |
|------|-----------|-------|--------|
| 1 | prod_0074 | 73.8 | EXACT |
| 2 | prod_0029 | 71.8 | EXACT |
| 3 | prod_0025 | 71.4 | EXACT |
| 4 | prod_0031 | 68.2 | EXACT |
| 5 | prod_0027 | 62.8 | EXACT |
| 6 | prod_0030 | 62.6 | EXACT |
| 7 | prod_0026 | 48.8 | EXACT |
| 8 | prod_0032 | 48.8 | EXACT |
| 9 | prod_0087 | 48.8 | EXACT |
| 10 | prod_0028 | 47.2 | EXACT |

### "toilet paper" (10 results — MATCH)

| Rank | Product ID | Score | Match? |
|------|-----------|-------|--------|
| 1 | prod_0021 | 108.2 | EXACT |
| 2 | prod_0019 | 102.4 | EXACT |
| 3 | prod_0023 | 92.2 | EXACT |
| 4 | prod_0022 | 87.4 | EXACT |
| 5 | prod_0017 | 87.0 | EXACT |
| 6 | prod_0084 | 82.4 | EXACT |
| 7 | prod_0024 | 80.8 | EXACT |
| 8 | prod_0018 | 79.6 | EXACT |
| 9 | prod_0020 | 79.6 | EXACT |
| 10 | prod_0082 | 34.2 | EXACT |

### "stapler" (9 results — MATCH)

| Rank | Product ID | Score | Match? |
|------|-----------|-------|--------|
| 1 | prod_0013 | 87.0 | EXACT |
| 2 | prod_0015 | 82.2 | EXACT |
| 3 | prod_0010 | 80.8 | EXACT |
| 4 | prod_0088 | 72.4 | EXACT |
| 5 | prod_0016 | 66.2 | EXACT |
| 6 | prod_0014 | 49.4 | EXACT |
| 7 | prod_0011 | 49.2 | EXACT |
| 8 | prod_0009 | 49.0 | EXACT |
| 9 | prod_0012 | 49.0 | EXACT |

## Summary

| Query | Python Count | TS Count | Rankings Match | Scores Match |
|-------|-------------|----------|---------------|-------------|
| smart watch | 9 | 9 | YES | YES |
| washer | 10 | 10 | YES | YES |
| toilet paper | 10 | 10 | YES | YES |
| stapler | 9 | 9 | YES | YES |

**Result: 4/4 golden fixtures produce identical result counts, rankings, and scores.**
**Algorithm parity: 100% across 38 scored results.**

## Reproduction

Both test scripts are in `mock-platform/docs/evidence/`:

```bash
# Python test (from repo root)
python3 mock-platform/docs/evidence/search-parity-test.py > /tmp/py-results.json

# TypeScript test (from mock-platform/)
cd mock-platform && bun run docs/evidence/search-parity-test.ts > /tmp/ts-results.json

# Compare
diff <(jq . /tmp/py-results.json) <(jq . /tmp/ts-results.json)
```

Raw result files: `mock-platform/docs/evidence/python-results.json`, `mock-platform/docs/evidence/typescript-results.json`.
