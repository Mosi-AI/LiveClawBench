/**
 * Search algorithm parity test — TypeScript side.
 *
 * Runs calculateRelevanceScore() from the Bun shop mock
 * against the golden fixture queries specified in the implementation plan.
 *
 * Usage (from mock-platform/):
 *   bun run docs/evidence/search-parity-test.ts
 *
 * Output: JSON with query results to stdout.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Resolve product data path
const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");
const PRODUCTS_PATH = resolve(
  REPO_ROOT,
  "tasks/watch-shop/environment/shop-app/frontend/data/sample_products.json",
);

// Golden fixtures from the implementation plan (AC-5.1)
const GOLDEN_QUERIES = ["smart watch", "washer", "toilet paper", "stapler"];

interface Product {
  id: string;
  title: string;
  rating: number;
  best_seller?: boolean;
  overall_pick?: boolean;
  [key: string]: unknown;
}

interface ScoredResult {
  id: string;
  title: string;
  score: number;
}

function calculateRelevanceScore(query: string, product: Product): number {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(" ");
  const title = (product.title ?? "").toLowerCase();
  const titleWords = title.split(" ");
  let score = 0;

  // Exact title match
  if (title === queryLower) {
    score += 100;
  }

  // Word match + position bonus
  for (const qWord of queryWords) {
    const positions: number[] = [];
    for (let i = 0; i < titleWords.length; i++) {
      if (titleWords[i] === qWord) positions.push(i);
    }
    if (positions.length > 0) {
      const positionBonus = Math.max(0, 10 - positions[0]);
      score += 20 + positionBonus;
    }
  }

  // Partial/substring match
  for (const qWord of queryWords) {
    if (qWord.length >= 3) {
      for (const tWord of titleWords) {
        if (tWord.includes(qWord) && tWord !== qWord) {
          score += 10;
          break;
        }
      }
    }
  }

  // Query coverage
  const matched = queryWords.filter((w) => title.includes(w)).length;
  const coverage = matched / queryWords.length;
  score += 30 * coverage;

  // Word frequency
  const wordFreq = new Map<string, number>();
  for (const w of titleWords) {
    wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
  }
  const freqBoost = queryWords.reduce(
    (sum, w) => sum + Math.min((wordFreq.get(w) ?? 0) * 5, 20),
    0,
  );
  score += freqBoost;

  // Quality boost
  score += (product.rating ?? 0) * 2;
  if (product.best_seller) score += 15;
  if (product.overall_pick) score += 15;

  return score;
}

function filterAndSortProducts(
  query: string,
  products: Product[],
  minRelevance = 10.0,
): ScoredResult[] {
  const results: ScoredResult[] = [];
  for (const p of products) {
    const score = calculateRelevanceScore(query, p);
    if (score >= minRelevance) {
      results.push({ id: p.id, title: p.title, score });
    }
  }

  results.sort((a, b) => b.score - a.score);

  // Fallback: retry with min_relevance=0 if no results
  if (results.length === 0 && minRelevance > 0) {
    return filterAndSortProducts(query, products, 0.0);
  }

  return results;
}

// Main
const products: Product[] = JSON.parse(readFileSync(PRODUCTS_PATH, "utf-8"));
console.error(`# Product count: ${products.length}`);

const output: Record<string, unknown> = { product_count: products.length, queries: {} as Record<string, ScoredResult[]> };

for (const query of GOLDEN_QUERIES) {
  const results = filterAndSortProducts(query, products);
  (output.queries as Record<string, ScoredResult[]>)[query] = results;
  console.error(`# Query: '${query}' → ${results.length} results`);
}

console.log(JSON.stringify(output, null, 2));
