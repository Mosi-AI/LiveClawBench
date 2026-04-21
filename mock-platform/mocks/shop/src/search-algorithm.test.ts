import { describe, expect, test } from "bun:test";
import {
  calculateRelevanceScore,
  filterAndSortProducts,
  searchProducts,
  type SearchableProduct,
} from "./search-algorithm";

// Real product data from the watch-shop task (91 products)
import rawProducts from "../../../../tasks/watch-shop/environment/shop-app/frontend/data/sample_products.json";

const PRODUCTS: SearchableProduct[] = (rawProducts as any[]).map((p) => ({
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
  test("watch: exact title match for Garmin Forerunner 55", () => {
    const product = PRODUCTS.find((p) =>
      p.title.includes("Garmin Forerunner 55")
    )!;
    expect(calculateRelevanceScore(product, "watch")).toMatchSnapshot();
  });

  test("samsung: partial match on SAMSUNG washer", () => {
    const product = PRODUCTS.find((p) => p.title.startsWith("SAMSUNG WA"))!;
    expect(calculateRelevanceScore(product, "samsung")).toMatchSnapshot();
  });

  test("fitbit: exact word match on Fitbit Inspire 3", () => {
    const product = PRODUCTS.find((p) => p.title.includes("Fitbit Inspire 3"))!;
    expect(calculateRelevanceScore(product, "fitbit")).toMatchSnapshot();
  });

  test("casio: no match returns low score", () => {
    const product = PRODUCTS[0]; // arbitrary product
    expect(calculateRelevanceScore(product, "casio")).toMatchSnapshot();
  });
});

describe("searchProducts — golden queries", () => {
  test("watch: returns ranked matches", () => {
    expect(searchProducts(PRODUCTS, "watch")).toMatchSnapshot();
  });

  test("samsung: returns ranked matches", () => {
    expect(searchProducts(PRODUCTS, "samsung")).toMatchSnapshot();
  });

  test("fitbit: returns ranked matches", () => {
    expect(searchProducts(PRODUCTS, "fitbit")).toMatchSnapshot();
  });

  test("casio: zero results", () => {
    expect(searchProducts(PRODUCTS, "casio")).toMatchSnapshot();
  });
});

describe("filterAndSortProducts — golden queries", () => {
  test("watch with similarity sort", () => {
    expect(
      filterAndSortProducts(PRODUCTS, { query: "watch", sortBy: "similarity" })
    ).toMatchSnapshot();
  });

  test("samsung with similarity sort", () => {
    expect(
      filterAndSortProducts(PRODUCTS, {
        query: "samsung",
        sortBy: "similarity",
      })
    ).toMatchSnapshot();
  });

  test("fitbit with similarity sort", () => {
    expect(
      filterAndSortProducts(PRODUCTS, { query: "fitbit", sortBy: "similarity" })
    ).toMatchSnapshot();
  });

  test("casio: zero-result fallback no-op", () => {
    // "casio" does not exist in the real product set, so this exercises the
    // zero-result fallback path (filterAndSortProducts retries with
    // minRelevance=0.0 on an already-empty list — a structural no-op).
    expect(
      filterAndSortProducts(PRODUCTS, { query: "casio", sortBy: "similarity" })
    ).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// Filter / sort edge cases (real data)
// ---------------------------------------------------------------------------

describe("filterAndSortProducts — price and rating filters on real data", () => {
  test("minPrice filter", () => {
    expect(
      filterAndSortProducts(PRODUCTS, { minPrice: 500, sortBy: "price_asc" })
    ).toMatchSnapshot();
  });

  test("maxPrice filter", () => {
    expect(
      filterAndSortProducts(PRODUCTS, { maxPrice: 20, sortBy: "price_asc" })
    ).toMatchSnapshot();
  });

  test("minRating filter", () => {
    expect(
      filterAndSortProducts(PRODUCTS, { minRating: 4.8, sortBy: "rating" })
    ).toMatchSnapshot();
  });

  test("price_asc sort without query", () => {
    expect(filterAndSortProducts(PRODUCTS, { sortBy: "price_asc" })).toMatchSnapshot();
  });

  test("price_desc sort without query", () => {
    expect(filterAndSortProducts(PRODUCTS, { sortBy: "price_desc" })).toMatchSnapshot();
  });

  test("rating sort without query", () => {
    expect(filterAndSortProducts(PRODUCTS, { sortBy: "rating" })).toMatchSnapshot();
  });
});
