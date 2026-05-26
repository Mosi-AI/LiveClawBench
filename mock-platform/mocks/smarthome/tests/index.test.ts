import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const { createSmarthomeApp } = await import("../src/index");

function createSeededMockApp() {
  process.env.MOCK_DATA_DIR = mkdtempSync(resolve(tmpdir(), "smarthome-mock-test-"));
  process.env.MOCK_SEED_PATH = resolve(
    import.meta.dir,
    "../../../../tasks/grocery-reorder/environment/seed.sql",
  );

  const mockApp = createSmarthomeApp();
  mockApp.seed?.();
  return mockApp;
}

describe("smarthome mock", () => {
  test("OpenAPI document includes business API routes", () => {
    const mockApp = createSeededMockApp();

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

  test("POST /api/coffee-schedule without date updates the benchmark day", async () => {
    const mockApp = createSeededMockApp();

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
      date: "2026-05-12",
      has_schedule: true,
      start_time: "09:15",
      status: "scheduled",
      beans_grams: 30,
      cancelled: false,
      updated_at: "2026-05-12T08:00:00Z",
    });

    const readRes = await mockApp.app.request("/api/coffee-schedule");
    expect(readRes.status).toBe(200);
    expect(await readRes.json()).toEqual({
      date: "2026-05-12",
      has_schedule: true,
      start_time: "09:15",
      status: "scheduled",
      beans_grams: 30,
      cancelled: false,
      updated_at: "2026-05-12T08:00:00Z",
    });
  });

  test("GET /api/coffee-schedule returns unset state for a date without a schedule", async () => {
    const mockApp = createSeededMockApp();

    const readRes = await mockApp.app.request("/api/coffee-schedule?date=2026-05-13");

    expect(readRes.status).toBe(200);
    expect(await readRes.json()).toEqual({
      date: "2026-05-13",
      has_schedule: false,
      start_time: null,
      status: "unset",
      beans_grams: null,
      cancelled: false,
      updated_at: null,
    });
  });

  test("POST /api/coffee-schedule can create a future schedule and rejects past dates", async () => {
    const mockApp = createSeededMockApp();

    const futureUpdateRes = await mockApp.app.request("/api/coffee-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-05-13",
        start_time: "06:45",
        beans_grams: 25,
        cancelled: false,
      }),
    });

    expect(futureUpdateRes.status).toBe(200);
    expect(await futureUpdateRes.json()).toEqual({
      date: "2026-05-13",
      has_schedule: true,
      start_time: "06:45",
      status: "scheduled",
      beans_grams: 25,
      cancelled: false,
      updated_at: "2026-05-12T08:00:00Z",
    });

    const futureReadRes = await mockApp.app.request("/api/coffee-schedule?date=2026-05-13");
    expect(futureReadRes.status).toBe(200);
    expect(await futureReadRes.json()).toEqual({
      date: "2026-05-13",
      has_schedule: true,
      start_time: "06:45",
      status: "scheduled",
      beans_grams: 25,
      cancelled: false,
      updated_at: "2026-05-12T08:00:00Z",
    });

    const pastUpdateRes = await mockApp.app.request("/api/coffee-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-05-11",
        start_time: "06:30",
        beans_grams: 20,
        cancelled: false,
      }),
    });

    expect(pastUpdateRes.status).toBe(400);
    expect(await pastUpdateRes.json()).toEqual({
      error: "Cannot modify coffee schedule for past dates",
    });
  });

  test("POST /api/inventory preserves legacy validation error shape", async () => {
    const mockApp = createSeededMockApp();

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
    const mockApp = createSeededMockApp();

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
      status: "undone",
      updated_at: "2026-05-12T08:00:00Z",
    });
  });

  test("GET /wearable preserves page availability", async () => {
    const mockApp = createSeededMockApp();

    const res = await mockApp.app.request("/wearable");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("GET /inventory preserves page availability", async () => {
    const mockApp = createSeededMockApp();

    const res = await mockApp.app.request("/inventory");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("all top-level HTML pages remain registered", async () => {
    const mockApp = createSeededMockApp();

    const pagePaths = [
      "/",
      "/thermostat",
      "/coffee",
      "/inventory",
      "/grocery",
      "/wearable",
      "/calendar",
      "/meal-plan",
    ];

    for (const pagePath of pagePaths) {
      const res = await mockApp.app.request(pagePath);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
    }
  });
});
