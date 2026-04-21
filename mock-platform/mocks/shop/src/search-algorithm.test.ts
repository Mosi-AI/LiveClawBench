import { describe, expect, test } from "bun:test";
import {
  calculateRelevanceScore,
  filterAndSortProducts,
  searchProducts,
  type SearchableProduct,
} from "./search-algorithm";

const PRODUCTS: SearchableProduct[] = [
  { id: "p1", title: "Apple Watch Series 9", price: 399, rating: 4.8 },
  { id: "p2", title: "Samsung Galaxy Watch 6", price: 299, rating: 4.5 },
  { id: "p3", title: "Garmin Fenix 7", price: 599, rating: 4.7, best_seller: true },
  { id: "p4", title: "Fitbit Charge 5", price: 149, rating: 4.2 },
  { id: "p5", title: "Casio Vintage Watch", price: 49, rating: 4.0, overall_pick: true },
];

describe("calculateRelevanceScore", () => {
  test("empty query returns 0", () => {
    expect(calculateRelevanceScore(PRODUCTS[0], "")).toBe(0);
    expect(calculateRelevanceScore(PRODUCTS[0], "   ")).toBe(0);
  });

  test("exact title match scores highest", () => {
    expect(calculateRelevanceScore(PRODUCTS[0], "apple watch series 9")).toMatchSnapshot();
  });

  test("partial word match scores lower", () => {
    expect(calculateRelevanceScore(PRODUCTS[0], "watch")).toMatchSnapshot();
    expect(calculateRelevanceScore(PRODUCTS[2], "fen")).toMatchSnapshot();
  });

  test("no match returns low score", () => {
    expect(calculateRelevanceScore(PRODUCTS[4], "samsung")).toMatchSnapshot();
  });

  test("best_seller and overall_pick boosts", () => {
    expect(calculateRelevanceScore(PRODUCTS[2], "garmin")).toMatchSnapshot();
    expect(calculateRelevanceScore(PRODUCTS[4], "casio")).toMatchSnapshot();
  });

  test("rating boost", () => {
    expect(calculateRelevanceScore(PRODUCTS[0], "apple")).toMatchSnapshot();
    expect(calculateRelevanceScore(PRODUCTS[4], "casio")).toMatchSnapshot();
  });
});

describe("searchProducts", () => {
  test("empty query returns all products with 0 score", () => {
    expect(searchProducts(PRODUCTS, "")).toMatchSnapshot();
  });

  test("filters by minRelevance", () => {
    expect(searchProducts(PRODUCTS, "watch", 50)).toMatchSnapshot();
  });

  test("returns matches sorted by relevance", () => {
    expect(searchProducts(PRODUCTS, "watch")).toMatchSnapshot();
  });

  test("no matches returns empty array", () => {
    expect(searchProducts(PRODUCTS, "xyz_nonexistent")).toMatchSnapshot();
  });
});

describe("filterAndSortProducts", () => {
  test("no filters returns all products", () => {
    expect(filterAndSortProducts(PRODUCTS, {})).toMatchSnapshot();
  });

  test("price filters", () => {
    expect(filterAndSortProducts(PRODUCTS, { minPrice: 200 })).toMatchSnapshot();
    expect(filterAndSortProducts(PRODUCTS, { maxPrice: 200 })).toMatchSnapshot();
    expect(filterAndSortProducts(PRODUCTS, { minPrice: 100, maxPrice: 400 })).toMatchSnapshot();
  });

  test("rating filter", () => {
    expect(filterAndSortProducts(PRODUCTS, { minRating: 4.5 })).toMatchSnapshot();
  });

  test("sort by price_asc", () => {
    expect(filterAndSortProducts(PRODUCTS, { sortBy: "price_asc" })).toMatchSnapshot();
  });

  test("sort by price_desc", () => {
    expect(filterAndSortProducts(PRODUCTS, { sortBy: "price_desc" })).toMatchSnapshot();
  });

  test("sort by rating", () => {
    expect(filterAndSortProducts(PRODUCTS, { sortBy: "rating" })).toMatchSnapshot();
  });

  test("query with similarity sort", () => {
    expect(filterAndSortProducts(PRODUCTS, { query: "watch", sortBy: "similarity" })).toMatchSnapshot();
  });

  test("query + price filter combined", () => {
    expect(filterAndSortProducts(PRODUCTS, { query: "watch", minPrice: 200, sortBy: "similarity" })).toMatchSnapshot();
  });

  test("useSearch=false ignores query", () => {
    expect(filterAndSortProducts(PRODUCTS, { query: "watch", useSearch: false, sortBy: "similarity" })).toMatchSnapshot();
  });
});
