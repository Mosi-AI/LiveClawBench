import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Database } from "bun:sqlite";
import { createTables } from "../src/schema.js";
import { resolveEffectiveBudget } from "../src/queries.js";
import type { FoodCatalog } from "../src/queries.js";
import { resetMutableTables } from "../src/routes/admin.js";
import { isCatalogQuantityUnit, parseManualMacros } from "../src/routes/log.js";

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

function withDb(testFn: (db: Database) => void): void {
  const db = new Database(":memory:");
  try {
    db.run("PRAGMA foreign_keys = ON");
    createTables(db);
    testFn(db);
  } finally {
    db.close();
  }
}

describe("resolveEffectiveBudget", () => {
  it("ignores draft and archived plan targets", () => withDb((db) => {
    db.prepare("INSERT INTO daily_log (log_date, calorie_budget_kcal) VALUES (?, ?)").run("2026-04-22", 1500);
    db.prepare(`
      INSERT INTO meal_plan (title, start_date, end_date, status, target_calories_kcal)
      VALUES (?, ?, ?, ?, ?)
    `).run("Draft Plan", "2026-04-20", "2026-04-25", "draft", 900);
    db.prepare(`
      INSERT INTO meal_plan (title, start_date, end_date, status, target_calories_kcal)
      VALUES (?, ?, ?, ?, ?)
    `).run("Archived Plan", "2026-04-20", "2026-04-25", "archived", 1200);

    const budget = resolveEffectiveBudget(db, "2026-04-22");
    assert.equal(budget.source, "daily_log");
    assert.equal(budget.budget, 1500);
  }));

  it("uses an active overlapping plan target", () => withDb((db) => {
    db.prepare("INSERT INTO daily_log (log_date, calorie_budget_kcal) VALUES (?, ?)").run("2026-04-22", 1500);
    db.prepare(`
      INSERT INTO meal_plan (title, start_date, end_date, status, target_calories_kcal)
      VALUES (?, ?, ?, ?, ?)
    `).run("Active Plan", "2026-04-20", "2026-04-25", "active", 1800);

    const budget = resolveEffectiveBudget(db, "2026-04-22");
    assert.equal(budget.source, "plan");
    assert.equal(budget.budget, 1800);
    assert.equal(budget.planTitle, "Active Plan");
  }));
});

describe("catalog quantity units", () => {
  it("allows only catalog serving unit or per-serving unit", () => {
    const catalog = makeCatalog({ serving_size_unit: "g" });

    assert.equal(isCatalogQuantityUnit(catalog, "g"), true);
    assert.equal(isCatalogQuantityUnit(catalog, "份"), true);
    assert.equal(isCatalogQuantityUnit(catalog, "oz"), false);
  });
});

describe("parseManualMacros", () => {
  it("defaults blank macro fields to zero", () => {
    assert.deepEqual(parseManualMacros({ calories_kcal: "", protein_g: "2.5" }), {
      values: { caloriesKcal: 0, proteinG: 2.5, carbsG: 0, fatG: 0 },
    });
  });

  it("rejects malformed non-blank macro fields", () => {
    assert.deepEqual(parseManualMacros({ calories_kcal: "abc" }), {
      error: "Invalid calories value",
    });
  });
});

describe("resetMutableTables", () => {
  it("clears mutable rows and resets AUTOINCREMENT sequences", () => withDb((db) => {
    db.prepare("INSERT INTO daily_log (log_date) VALUES (?)").run("2026-04-22");
    assert.equal((db.query("SELECT id FROM daily_log").get() as { id: number }).id, 1);

    resetMutableTables(db);

    db.prepare("INSERT INTO daily_log (log_date) VALUES (?)").run("2026-04-23");
    assert.equal((db.query("SELECT id FROM daily_log").get() as { id: number }).id, 1);
  }));
});
