# Shop Search: Golden-Query Parity Evidence

## Dataset Clarification

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

## Results

### "smart watch" (9 results — MATCH)

| Rank | Python ID | Python Score | TS Score | Match? |
|------|-----------|-------------|----------|--------|
| 1 | prod_0068 | 133.8 | 133.8 | EXACT |
| 2 | prod_0064 | 108.8 | 108.8 | EXACT |
| 3 | prod_0069 | 88.4 | 88.4 | EXACT |
| 4 | prod_0072 | 56.0 | 56.0 | EXACT |
| 5 | prod_0063 | 54.2 | 54.2 | EXACT |

### "wireless earbuds" (1 result — MATCH)

| Rank | Python ID | Python Score | TS Score | Match? |
|------|-----------|-------------|----------|--------|
| 1 | prod_0062 | 49.4 | 49.4 | EXACT |

### "laptop stand" (10 results — MATCH)

| Rank | Python ID | Python Score | TS Score | Match? |
|------|-----------|-------------|----------|--------|
| 1 | prod_0039 | 49.2 | 49.2 | EXACT |
| 2 | prod_0041 | 49.2 | 49.2 | EXACT |
| 3 | prod_0042 | 49.2 | 49.2 | EXACT |
| 4 | prod_0053 | 19.6 | 19.6 | EXACT |
| 5 | prod_0023 | 19.2 | 19.2 | EXACT |

### "coffee maker" (1 result — MATCH)

| Rank | Python ID | Python Score | TS Score | Match? |
|------|-----------|-------------|----------|--------|
| 1 | prod_0008 | 49.4 | 49.4 | EXACT |

### "USB cable" (8 results — MATCH)

| Rank | Python ID | Python Score | TS Score | Match? |
|------|-----------|-------------|----------|--------|
| 1 | prod_0035 | 113.2 | 113.2 | EXACT |
| 2 | prod_0034 | 112.0 | 112.0 | EXACT |
| 3 | prod_0037 | 111.4 | 111.4 | EXACT |
| 4 | prod_0073 | 109.2 | 109.2 | EXACT |
| 5 | prod_0086 | 107.2 | 107.2 | EXACT |

## Summary

| Query | Python Count | TS Count | Top-5 IDs Match | Scores Match |
|-------|-------------|----------|----------------|-------------|
| smart watch | 9 | 9 | YES | YES |
| wireless earbuds | 1 | 1 | YES | YES |
| laptop stand | 10 | 10 | YES | YES |
| coffee maker | 1 | 1 | YES | YES |
| USB cable | 8 | 8 | YES | YES |

**Result: 5/5 queries produce identical result counts, rankings, and scores.**
**Algorithm parity: 100%**

## Reproduction

Python test:
```bash
python3 -c "
import json, re
from collections import Counter
products = json.load(open('tasks/watch-shop/environment/shop-app/frontend/data/sample_products.json'))
# ... (see calculate_relevance_score in app.py) ...
"
```

TypeScript test:
```bash
bun run /tmp/ts-parity-test.ts
```

Both use the same product data file and same algorithm logic.
