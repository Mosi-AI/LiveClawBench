import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const tempDataDir = mkdtempSync(resolve(tmpdir(), "smarthome-mock-test-"));
process.env.MOCK_DATA_DIR = tempDataDir;
process.env.MOCK_SEED_PATH = resolve(
  import.meta.dir,
  "../../../../tasks/grocery-reorder/environment/seed.sql",
);

const { createSmarthomeApp } = await import("../src/index");

describe("smarthome mock", () => {
  test("OpenAPI document includes business API routes", () => {
    const mockApp = createSmarthomeApp();
    mockApp.seed?.();

    const document = mockApp.app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: mockApp.openApiInfo!,
    });

    expect(document.paths?.["/api/thermostat"]?.get).toBeDefined();
    expect(document.paths?.["/api/thermostat"]?.post).toBeDefined();
    expect(document.paths?.["/api/coffee-schedule"]?.get).toBeDefined();
    expect(document.paths?.["/api/coffee-schedule"]?.post).toBeDefined();
    expect(document.paths?.["/api/inventory"]?.get).toBeDefined();
    expect(document.paths?.["/api/inventory"]?.post).toBeDefined();
    expect(document.paths?.["/api/inventory/{id}"]?.put).toBeDefined();
    expect(document.paths?.["/api/inventory/{id}"]?.delete).toBeDefined();
    expect(document.paths?.["/api/grocery/products"]?.get).toBeDefined();
    expect(document.paths?.["/api/grocery/products"]?.post).toBeDefined();
    expect(document.paths?.["/api/grocery/products/{id}"]?.put).toBeDefined();
    expect(document.paths?.["/api/grocery/products/{id}"]?.delete).toBeDefined();
    expect(document.paths?.["/api/wearable-recovery"]?.get).toBeDefined();
    expect(document.paths?.["/api/calendar"]?.get).toBeDefined();
    expect(document.paths?.["/api/calendar/{id}"]?.get).toBeDefined();
    expect(document.paths?.["/api/calendar/{id}"]?.put).toBeDefined();
    expect(document.paths?.["/api/constraints"]?.get).toBeDefined();
    expect(document.paths?.["/api/recipes"]?.get).toBeDefined();
    expect(document.paths?.["/api/meal-plan"]?.get).toBeDefined();
    expect(document.paths?.["/api/meal-plan"]?.post).toBeDefined();
    expect(document.paths?.["/api/meal-plan"]?.delete).toBeDefined();
  });

  test("POST /api/coffee-schedule preserves response shape and persisted state", async () => {
    const mockApp = createSmarthomeApp();
    mockApp.seed?.();

    const updateRes = await mockApp.app.request("/api/coffee-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start_time: "09:15",
        beans_grams: 30,
        cancelled: false,
      }),
    });

    expect(updateRes.status).toBe(200);
    expect(await updateRes.json()).toEqual({
      start_time: "09:15",
      beans_grams: 30,
      cancelled: false,
      updated_at: "2026-05-12T08:00:00Z",
    });

    const readRes = await mockApp.app.request("/api/coffee-schedule");
    expect(readRes.status).toBe(200);
    expect(await readRes.json()).toEqual({
      start_time: "09:15",
      status: "scheduled",
      beans_grams: 30,
      cancelled: false,
      updated_at: "2026-05-12T08:00:00Z",
    });
  });

  test("POST /api/inventory preserves legacy validation error shape", async () => {
    const mockApp = createSmarthomeApp();
    mockApp.seed?.();

    const res = await mockApp.app.request("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_name: "Eggs" }),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Missing required fields: item_name, quantity, unit, location",
    });
  });

  test("PUT /api/calendar/:id preserves workout normalization and response shape", async () => {
    const mockApp = createSmarthomeApp();
    mockApp.seed?.();

    const res = await mockApp.app.request("/api/calendar/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workout_type: "WALKING" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 1,
      title: "Morning Workout",
      start_time: "2026-05-12T08:00:00Z",
      event_type: "workout",
      workout_type: "walking",
      updated_at: "2026-05-12T08:00:00Z",
    });
  });
});
