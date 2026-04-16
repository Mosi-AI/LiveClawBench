/**
 * Search algorithm parity test — TypeScript side.
 *
 * Directly imports the REAL search functions from
 * mocks/shop/src/search-algorithm.ts (calculateRelevanceScore,
 * searchProducts, filterAndSortProducts) and calls them with the real
 * product data. No HTTP server involved, no source patching.
 *
 * Produces per-product scores and final filter flow outputs that can be
 * compared 1:1 against the Python harness output.
 *
 * Usage (from mock-platform/):
 *   bun run docs/evidence/search-parity-test.ts
 *
 * Output: JSON with per-product scores and final filter flow results to stdout.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  calculateRelevanceScore,
  searchProducts,
  filterAndSortProducts,
} from "../../mocks/shop/src/search-algorithm.js";
import type { SearchableProduct } from "../../mocks/shop/src/search-algorithm.js";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");
const PRODUCTS_PATH = resolve(
  REPO_ROOT,
  "tasks/watch-shop/environment/shop-app/frontend/data/sample_products.json",
);

const GOLDEN_QUERIES = ["smart watch", "washer", "toilet paper", "stapler"];

interface Product extends SearchableProduct {
  rating_count: string;
  image_url: string;
  sponsored?: boolean;
  limited_time?: boolean;
  discounted?: boolean;
  low_stock?: boolean;
  stock_quantity?: number | null;
}

async function runParityTest(): Promise<void> {
  const products: Product[] = JSON.parse(readFileSync(PRODUCTS_PATH, "utf-8"));

  console.error(`# Product count: ${products.length}`);
  console.error(`# Using REAL functions from mocks/shop/src/search-algorithm.ts:`);
  console.error(`#   - calculateRelevanceScore()`);
  console.error(`#   - searchProducts()`);
  console.error(`#   - filterAndSortProducts()`);

  const output: Record<string, unknown> = {
    product_count: products.length,
    source: "mocks/shop/src/search-algorithm.ts (direct import)",
    functions_used: [
      "calculateRelevanceScore",
      "searchProducts",
      "filterAndSortProducts",
    ],
    queries: {} as Record<string, unknown>,
  };

  for (const query of GOLDEN_QUERIES) {
    // 1. Per-product scores from calculateRelevanceScore
    const perProductScores: Record<string, number> = {};
    for (const p of products) {
      const score = calculateRelevanceScore(p, query);
      if (score >= 10.0) {
        perProductScores[p.id] = score;
      }
    }

    // 2. searchProducts results (applies threshold + sort)
    const scored = searchProducts(products, query);
    const searchResults = scored.map(([p, s]) => ({ id: p.id, score: s }));

    // 3. filterAndSortProducts results (full production flow)
    const sorted = filterAndSortProducts(products, { query });
    const filterResults = sorted.map((p) => ({
      id: p.id,
      title: p.title,
    }));

    (output.queries as Record<string, unknown>)[query] = {
      per_product_scores: perProductScores,
      search_products_count: searchResults.length,
      search_products_top10: searchResults.slice(0, 10),
      filter_and_sort_count: filterResults.length,
      filter_and_sort_ids: filterResults.map((r) => r.id),
      filter_and_sort_top10: filterResults.slice(0, 10),
    };

    console.error(
      `# Query: '${query}' -> ${searchResults.length} scored, ${filterResults.length} filtered/sorted`,
    );
  }

  console.log(JSON.stringify(output, null, 2));
}

runParityTest();
