// This suite covers multiple pure helpers: scaleMacros and isValidLocalDate, both sourced from queries.ts
import { describe, expect, test } from "bun:test";
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
  expect(Math.abs(actual - expected), `Expected ~${expected}, got ${actual}`).toBeLessThan(tolerance);

describe("scaleMacros", () => {
  test("份 unit multiplies macros by quantity_value directly", () => {
    const catalog = makeCatalog();
    const result = scaleMacros(catalog, 2, "份");
    approx(result.calories, 400);
    approx(result.protein, 20);
    approx(result.carbs, 60);
    approx(result.fat, 10);
  });

  test("native unit divides by serving_size_value then multiplies by quantity", () => {
    const catalog = makeCatalog({ serving_size_value: 100, calories_kcal: 200, protein_g: 10, carbs_g: 30, fat_g: 5 });
    const result = scaleMacros(catalog, 50, "g"); // factor 0.5
    approx(result.calories, 100);
    approx(result.protein, 5);
    approx(result.carbs, 15);
    approx(result.fat, 2.5);
  });

  test("NULL catalog macros return zeros not NaN", () => {
    const catalog = makeCatalog({ calories_kcal: null, protein_g: null, carbs_g: null, fat_g: null });
    const result = scaleMacros(catalog, 1, "份");
    expect(result.calories).toBe(0);
    expect(result.protein).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(0);
    expect(Number.isNaN(result.calories)).toBe(false);
  });

  test("throws when catalog serving size is invalid", () => {
    const catalog = makeCatalog({ serving_size_value: 0 });
    expect(() => scaleMacros(catalog, 50, "g")).toThrow(/Invalid serving size/);
  });
});

describe("isValidLocalDate", () => {
  test("accepts valid calendar date", () => {
    expect(isValidLocalDate("2026-04-22")).toBe(true);
  });

  test("rejects invalid month 13", () => {
    expect(isValidLocalDate("2026-13-45")).toBe(false);
  });

  test("rejects Feb 30", () => {
    expect(isValidLocalDate("2026-02-30")).toBe(false);
  });
});
