import { describe, expect, test } from "bun:test";
import {
  calculateRelevanceScore,
  filterAndSortProducts,
  searchProducts,
  type SearchableProduct,
} from "../src/search-algorithm";

// Real product data from the watch-shop task (91 products).
// NOTE: These tests depend on sample_products.json fixture data.
// If the fixture changes (product IDs, titles, or count), update the
// golden-query expectations below.
import rawProducts from "../../../static/shop/sample_products.json";

const PRODUCTS: SearchableProduct[] = (rawProducts as SearchableProduct[]).map((p) => ({
  id: p.id,
  title: p.title,
  price: p.price,
  rating: p.rating,
  best_seller: p.best_seller,
  overall_pick: p.overall_pick,
}));

// ---------------------------------------------------------------------------
// Golden-query coverage across all 3 exported functions
// ---------------------------------------------------------------------------

describe("calculateRelevanceScore — golden queries", () => {
  test("watch: exact title match gets high relevance score", () => {
    const product = PRODUCTS.find(p => p.title.includes("Garmin Forerunner 55"))!;
    const score = calculateRelevanceScore(product, "watch");
    expect(score).toBeGreaterThan(50);
  });

  test("samsung: partial match on SAMSUNG washer", () => {
    const product = PRODUCTS.find(p => p.title.startsWith("SAMSUNG WA"))!;
    const score = calculateRelevanceScore(product, "samsung");
    expect(score).toBeGreaterThan(30);
  });

  test("fitbit: exact word match on Fitbit Inspire 3", () => {
    const product = PRODUCTS.find(p => p.title.includes("Fitbit Inspire 3"))!;
    const score = calculateRelevanceScore(product, "fitbit");
    expect(score).toBeGreaterThan(50);
  });

  test("casio: no match returns low score", () => {
    const product = PRODUCTS[0];
    const score = calculateRelevanceScore(product, "casio");
    expect(score).toBeLessThan(15);
  });
});

describe("searchProducts — golden queries", () => {
  test("watch: returns ranked matches in descending score order", () => {
    const results = searchProducts(PRODUCTS, "watch");
    expect(results.length).toBeGreaterThan(1);
    expect(results[0][1]).toBeGreaterThan(results[1][1]);
    expect(results.some(([p]) => p.id === "prod_0068")).toBe(true);
  });

  test("samsung: returns ranked matches", () => {
    const results = searchProducts(PRODUCTS, "samsung");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(([p]) => p.title.startsWith("SAMSUNG"))).toBe(true);
  });

  test("fitbit: returns ranked matches", () => {
    const results = searchProducts(PRODUCTS, "fitbit");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(([p]) => p.title.includes("Fitbit"))).toBe(true);
  });

  test("casio: zero results", () => {
    const results = searchProducts(PRODUCTS, "casio");
    expect(results.length).toBe(0);
  });
});

describe("filterAndSortProducts — golden queries", () => {
  test("watch with similarity sort", () => {
    const results = filterAndSortProducts(PRODUCTS, {
      query: "watch",
      sortBy: "similarity",
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(p => p.title.includes("Garmin"))).toBe(true);
  });

  test("samsung with similarity sort", () => {
    const results = filterAndSortProducts(PRODUCTS, {
      query: "samsung",
      sortBy: "similarity",
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(p => p.title.startsWith("SAMSUNG"))).toBe(true);
  });

  test("fitbit with similarity sort", () => {
    const results = filterAndSortProducts(PRODUCTS, {
      query: "fitbit",
      sortBy: "similarity",
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(p => p.title.includes("Fitbit"))).toBe(true);
  });

  test("casio: zero-result fallback no-op", () => {
    const results = filterAndSortProducts(PRODUCTS, {
      query: "casio",
      sortBy: "similarity",
    });
    expect(results.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Filter / sort edge cases (real data)
// ---------------------------------------------------------------------------

describe("filterAndSortProducts — price and rating filters on real data", () => {
  test("minPrice filter", () => {
    const results = filterAndSortProducts(PRODUCTS, { minPrice: 500, sortBy: "price_asc" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(p => p.price >= 500)).toBe(true);
  });

  test("maxPrice filter", () => {
    const results = filterAndSortProducts(PRODUCTS, { maxPrice: 20, sortBy: "price_asc" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(p => p.price <= 20)).toBe(true);
  });

  test("minRating filter", () => {
    const results = filterAndSortProducts(PRODUCTS, { minRating: 4.8, sortBy: "rating" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(p => p.rating >= 4.8)).toBe(true);
  });

  test("price_asc sort without query", () => {
    const results = filterAndSortProducts(PRODUCTS, { sortBy: "price_asc" });
    expect(results.length).toBeGreaterThan(1);
    expect(results[0].price).toBeLessThanOrEqual(results[1].price);
  });

  test("price_desc sort without query", () => {
    const results = filterAndSortProducts(PRODUCTS, { sortBy: "price_desc" });
    expect(results.length).toBeGreaterThan(1);
    expect(results[0].price).toBeGreaterThanOrEqual(results[1].price);
  });

  test("rating sort without query", () => {
    const results = filterAndSortProducts(PRODUCTS, { sortBy: "rating" });
    expect(results.length).toBeGreaterThan(1);
    expect(results[0].rating).toBeGreaterThanOrEqual(results[1].rating);
  });
});
