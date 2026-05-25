import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetInjectionState } from "mock-lib";
import { createMintDietApp } from "../src/index";
import type { OpenAPIApp } from "mock-lib";

describe("mint-diet C-axis fault injection", () => {
  let dataDir: string;
  let app: OpenAPIApp;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "mint-diet-c-test-"));
    process.env.MOCK_DATA_DIR = dataDir;
    resetInjectionState();
    delete process.env.TASK_NAME;
  });

  afterEach(() => {
    try { rmSync(dataDir, { recursive: true, force: true }); } catch {}
    delete process.env.MOCK_DATA_DIR;
    delete process.env.TASK_NAME;
  });

  // ---------------------------------------------------------------------------
  // C1 — mint-diet-stockout
  // ---------------------------------------------------------------------------

  describe("C1: mint-diet-stockout", () => {
    beforeEach(async () => {
      process.env.TASK_NAME = "mint-diet-stockout";
      const mintDiet = createMintDietApp();
      app = mintDiet.app;
      await mintDiet.seed?.();
    });

    test("first search returns results but deletes food rows", async () => {
      // Search for something
      const searchRes = await app.request("/api/food-catalog/search?q=chicken");
      expect(searchRes.status).toBe(200);
      const searchData = await searchRes.json();
      expect(searchData.data.length).toBeGreaterThan(0);

      const foodId = searchData.data[0].id;

      // The food should now be deleted (second search or direct get)
      const getRes = await app.request(`/api/food-catalog/${foodId}`);
      expect(getRes.status).toBe(404);
    });

    test("second search does not delete new results (one-shot)", async () => {
      // First search triggers deletion
      const first = await app.request("/api/food-catalog/search?q=spinach");
      const firstData = await first.json();
      expect(firstData.data.length).toBeGreaterThan(0);

      // Second search for a different food — should NOT delete
      const second = await app.request("/api/food-catalog/search?q=beef");
      const secondData = await second.json();

      if (secondData.data.length > 0) {
        const foodId = secondData.data[0].id;
        const getRes = await app.request(`/api/food-catalog/${foodId}`);
        // Should still exist (one-shot already fired)
        expect(getRes.status).toBe(200);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Non-C task — no injection
  // ---------------------------------------------------------------------------

  describe("non-C task: no fault injection", () => {
    beforeEach(async () => {
      process.env.TASK_NAME = "mint-diet-snack-log";
      const mintDiet = createMintDietApp();
      app = mintDiet.app;
      await mintDiet.seed?.();
    });

    test("search returns results and food stays in catalog", async () => {
      const searchRes = await app.request("/api/food-catalog/search?q=chicken");
      expect(searchRes.status).toBe(200);
      const data = await searchRes.json();
      expect(data.data.length).toBeGreaterThan(0);

      const foodId = data.data[0].id;
      const getRes = await app.request(`/api/food-catalog/${foodId}`);
      expect(getRes.status).toBe(200);
    });
  });
});
