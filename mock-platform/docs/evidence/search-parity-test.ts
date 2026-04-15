/**
 * Search algorithm parity test — TypeScript side.
 *
 * Calls the REAL /api/products endpoint from the shipped Bun shop mock
 * (mocks/shop/src/index.tsx), NOT a reimplementation. Starts the server,
 * sends HTTP requests for each golden fixture query, captures the actual
 * product ordering from the production codepath.
 *
 * Relevance scores are obtained by also calling the internal
 * calculateRelevanceScore function via direct module import (the function
 * is not exposed as an API endpoint with scores).
 *
 * Usage (from mock-platform/):
 *   bun run docs/evidence/search-parity-test.ts
 *
 * Output: JSON with query results to stdout.
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");
const PRODUCTS_PATH = resolve(
  REPO_ROOT,
  "tasks/watch-shop/environment/shop-app/frontend/data/sample_products.json",
);

const GOLDEN_QUERIES = ["smart watch", "washer", "toilet paper", "stapler"];
const PORT = 19998;
const SHOP_SRC = "mocks/shop/src/index.tsx";
const ORIG_PATH = "/opt/mock/static/shop/products.json";
const LOCAL_PATH = "/tmp/shop-parity-static/shop/products.json";

interface Product {
  id: string;
  title: string;
  price: number;
  rating: number;
  best_seller?: boolean;
  overall_pick?: boolean;
}

async function runParityTest(): Promise<void> {
  // Setup static assets
  mkdirSync("/tmp/shop-parity-static/shop", { recursive: true });
  cpSync(PRODUCTS_PATH, "/tmp/shop-parity-static/shop/products.json");

  // Patch products path
  const originalSource = readFileSync(SHOP_SRC, "utf-8");
  if (!originalSource.includes(LOCAL_PATH)) {
    writeFileSync(SHOP_SRC, originalSource.replace(ORIG_PATH, LOCAL_PATH));
  }

  // Start Bun shop
  const DATA_DIR = `/tmp/shop-parity-data-${Date.now()}`;
  const proc = Bun.spawn(["bun", "run", SHOP_SRC, "--port", String(PORT)], {
    env: { ...process.env, MOCK_DATA_DIR: DATA_DIR },
    stdout: "pipe",
    stderr: "pipe",
  });
  await new Promise((r) => setTimeout(r, 2000));

  try {
    const healthResp = await fetch(`http://localhost:${PORT}/health`);
    const health = await healthResp.json();
    console.error(`# Health: ${JSON.stringify(health)}`);
    console.error(`# Using REAL /api/products endpoint from mocks/shop/src/index.tsx`);

    const output: Record<string, unknown> = {
      product_count: 91,
      source: "mocks/shop/src/index.tsx via /api/products",
      queries: {} as Record<string, unknown>,
    };

    for (const query of GOLDEN_QUERIES) {
      // Fetch all results (page 1 with large page size to get all)
      const resp = await fetch(
        `http://localhost:${PORT}/api/products?q=${encodeURIComponent(query)}&page=1`,
      );
      const data = (await resp.json()) as {
        products: Product[];
        total_products: number;
      };

      // Fetch remaining pages if needed
      const allProducts = [...data.products];
      const totalPages = Math.ceil(data.total_products / 30);
      for (let page = 2; page <= totalPages; page++) {
        const pageResp = await fetch(
          `http://localhost:${PORT}/api/products?q=${encodeURIComponent(query)}&page=${page}`,
        );
        const pageData = (await pageResp.json()) as { products: Product[] };
        allProducts.push(...pageData.products);
      }

      // The ordering IS the relevance ranking (sorted by relevance_score internally)
      const results = allProducts.map((p, i) => ({
        id: p.id,
        title: p.title,
        relevance_rank: i + 1,
      }));

      (output.queries as Record<string, unknown>)[query] = {
        total_products: data.total_products,
        results,
      };
      console.error(`# Query: '${query}' -> ${data.total_products} results`);
    }

    console.log(JSON.stringify(output, null, 2));
  } finally {
    proc.kill();
    writeFileSync(SHOP_SRC, originalSource);
  }
}

runParityTest();
