// This suite covers multiple pure helpers: scaleMacros and isValidLocalDate, both sourced from queries.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scaleMacros, isValidLocalDate } from "../src/queries.js";
import type { FoodCatalog } from "../src/queries.js";

const makeCatalog = (overrides: Partial<FoodCatalog> = {}): FoodCatalog => ({
  id: 1,
  name: "Test Food",
  serving_size_value: 100,
  serving_size_unit: "g",
  calories_kcal: 200,
  protein_g: 10,
  carbs_g: 30,
  fat_g: 5,
  ...overrides,
});

const approx = (actual: number, expected: number, tolerance = 0.001) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `Expected ~${expected}, got ${actual}`);

describe("scaleMacros", () => {
  it("份 unit multiplies macros by quantity_value directly", () => {
    const catalog = makeCatalog();
    const result = scaleMacros(catalog, 2, "份");
    approx(result.calories, 400);
    approx(result.protein, 20);
    approx(result.carbs, 60);
    approx(result.fat, 10);
  });

  it("native unit divides by serving_size_value then multiplies by quantity", () => {
    const catalog = makeCatalog({ serving_size_value: 100, calories_kcal: 200, protein_g: 10, carbs_g: 30, fat_g: 5 });
    const result = scaleMacros(catalog, 50, "g"); // factor 0.5
    approx(result.calories, 100);
    approx(result.protein, 5);
    approx(result.carbs, 15);
    approx(result.fat, 2.5);
  });

  it("NULL catalog macros return zeros not NaN", () => {
    const catalog = makeCatalog({ calories_kcal: null, protein_g: null, carbs_g: null, fat_g: null });
    const result = scaleMacros(catalog, 1, "份");
    assert.equal(result.calories, 0);
    assert.equal(result.protein, 0);
    assert.equal(result.carbs, 0);
    assert.equal(result.fat, 0);
    assert.equal(Number.isNaN(result.calories), false);
  });

  it("throws when catalog serving size is invalid", () => {
    const catalog = makeCatalog({ serving_size_value: 0 });
    assert.throws(() => scaleMacros(catalog, 50, "g"), /Invalid serving size/);
  });
});

describe("isValidLocalDate", () => {
  it("accepts valid calendar date", () => {
    assert.equal(isValidLocalDate("2026-04-22"), true);
  });

  it("rejects invalid month 13", () => {
    assert.equal(isValidLocalDate("2026-13-45"), false);
  });

  it("rejects Feb 30", () => {
    assert.equal(isValidLocalDate("2026-02-30"), false);
  });
});
