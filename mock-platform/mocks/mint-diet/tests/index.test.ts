import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIApp } from "mock-lib";
import { createMintDietApp } from "../src/index";
import { createTables } from "../src/schema.js";
import { resolveEffectiveBudget } from "../src/queries.js";
import type { FoodCatalog } from "../src/queries.js";
import { resetMutableTables } from "../src/routes/api/admin.js";
import { CreateMealPlanBodySchema } from "../src/routes/api/schemas.js";
import { isCatalogQuantityUnit, parseManualMacros } from "../src/routes/log-shared.js";

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
  test("ignores draft and archived plan targets", () => withDb((db) => {
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
    expect(budget.source).toBe("daily_log");
    expect(budget.budget).toBe(1500);
  }));

  test("uses an active overlapping plan target", () => withDb((db) => {
    db.prepare("INSERT INTO daily_log (log_date, calorie_budget_kcal) VALUES (?, ?)").run("2026-04-22", 1500);
    db.prepare(`
      INSERT INTO meal_plan (title, start_date, end_date, status, target_calories_kcal)
      VALUES (?, ?, ?, ?, ?)
    `).run("Active Plan", "2026-04-20", "2026-04-25", "active", 1800);

    const budget = resolveEffectiveBudget(db, "2026-04-22");
    expect(budget.source).toBe("plan");
    expect(budget.budget).toBe(1800);
    expect(budget.planTitle).toBe("Active Plan");
  }));
});

describe("catalog quantity units", () => {
  test("allows only catalog serving unit or per-serving unit", () => {
    const catalog = makeCatalog({ serving_size_unit: "g" });

    expect(isCatalogQuantityUnit(catalog, "g")).toBe(true);
    expect(isCatalogQuantityUnit(catalog, "份")).toBe(true);
    expect(isCatalogQuantityUnit(catalog, "oz")).toBe(false);
  });
});

describe("parseManualMacros", () => {
  test("defaults blank macro fields to zero", () => {
    expect(parseManualMacros({ calories_kcal: "", protein_g: "2.5" })).toEqual({
      values: { caloriesKcal: 0, proteinG: 2.5, carbsG: 0, fatG: 0 },
    });
  });

  test("rejects malformed non-blank macro fields", () => {
    expect(parseManualMacros({ calories_kcal: "abc" })).toEqual({
      error: "Invalid calories value",
    });
  });
});

describe("resetMutableTables", () => {
  test("clears mutable rows and resets AUTOINCREMENT sequences", () => withDb((db) => {
    db.prepare("INSERT INTO daily_log (log_date) VALUES (?)").run("2026-04-22");
    expect((db.query("SELECT id FROM daily_log").get() as { id: number }).id).toBe(1);

    resetMutableTables(db);

    db.prepare("INSERT INTO daily_log (log_date) VALUES (?)").run("2026-04-23");
    expect((db.query("SELECT id FROM daily_log").get() as { id: number }).id).toBe(1);
  }));
});

describe("mint-diet API routes", () => {
  let dataDir: string;
  let app: OpenAPIApp;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "mint-diet-test-"));
    process.env.MOCK_DATA_DIR = dataDir;
    const mintDiet = createMintDietApp();
    mintDiet.config.dev = true;
    app = mintDiet.app;
    await mintDiet.seed?.();
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
    delete process.env.MOCK_DATA_DIR;
  });

  test("creates a manual log entry through the API route", async () => {
    const res = await app.request("/api/log/2026-04-22/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slot: "breakfast",
        food_name: "manual oats",
        quantity_value: 1,
        quantity_unit: "serving",
        calories_kcal: 250,
        protein_g: 8,
        carbs_g: 40,
        fat_g: 5,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.food_name).toBe("manual oats");
    expect(body.data.meal_slot).toBe("breakfast");
  });

  test("rejects reversed meal plan dates at schema and HTTP layers", async () => {
    const invalidPlan = {
      title: "Bad Plan",
      start_date: "2026-04-25",
      end_date: "2026-04-22",
      status: "draft",
    };

    expect(CreateMealPlanBodySchema.safeParse(invalidPlan).success).toBe(false);

    const res = await app.request("/api/meal-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidPlan),
    });
    expect(res.status).toBe(400);
  });

  test("searches seeded foods and exposes mint-diet paths in OpenAPI", async () => {
    const search = await app.request("/api/food-catalog/search?q=oat");
    expect(search.status).toBe(200);
    const searchBody = await search.json();
    expect(searchBody.success).toBe(true);
    expect(searchBody.data.some((food: { food_name: string }) => food.food_name === "oatmeal")).toBe(true);

    const spec = await app.request("/openapi.json");
    expect(spec.status).toBe(200);
    const openApi = await spec.json();
    expect(openApi.paths["/api/log/{date}/entries"]).toBeDefined();
    expect(openApi.paths["/api/meal-plans"]).toBeDefined();
    expect(openApi.paths["/api/food-catalog/search"]).toBeDefined();
  });
});
