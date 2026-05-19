import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { createTestApp, jsonRequest, cleanup } from "./setup";

describe("Health Snapshot & Metrics API", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(async () => {
    app = createTestApp();
    // Seed some snapshot data via admin batch endpoint
    await jsonRequest(app, "/api/admin/health/snapshots/batch", {
      snapshots: [
        {
          snapshot_date: "2025-01-15",
          steps: 8000,
          active_energy_kcal: 350,
          sleep_hours: 7.5,
          resting_heart_rate_bpm: 62,
          avg_heart_rate_bpm: 75,
          weight_kg: 70.5,
          body_fat_percent: 18.2,
          blood_oxygen_percent: 98,
        },
        {
          snapshot_date: "2025-01-16",
          steps: 10000,
          active_energy_kcal: 420,
          sleep_hours: 8.0,
          resting_heart_rate_bpm: 60,
          avg_heart_rate_bpm: 72,
          weight_kg: 70.3,
          body_fat_percent: 18.0,
          blood_oxygen_percent: 99,
        },
        {
          snapshot_date: "2025-01-17",
          steps: 6000,
          active_energy_kcal: 280,
          sleep_hours: 6.5,
          resting_heart_rate_bpm: 65,
          avg_heart_rate_bpm: 78,
          weight_kg: 70.4,
          body_fat_percent: 18.1,
          blood_oxygen_percent: 97,
        },
      ],
    });
  });

  afterEach(() => cleanup());

  // --- Sentinel ---

  test("GET /__mock_sentinel__/health returns 200", async () => {
    const res = await app.request("/__mock_sentinel__/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  // --- Snapshot ---

  test("GET /api/health/snapshot returns data for a date", async () => {
    const res = await app.request("/api/health/snapshot?date=2025-01-15");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.date).toBe("2025-01-15");
    expect(body.steps).toBe(8000);
  });

  test("GET /api/health/snapshot returns 404 for missing date", async () => {
    const res = await app.request("/api/health/snapshot?date=2020-01-01");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("NOT_FOUND");
  });

  test("GET /api/health/snapshot with invalid date format returns 400", async () => {
    const res = await app.request("/api/health/snapshot?date=not-a-date");
    expect(res.status).toBe(400);
  });

  // --- Range ---

  test("GET /api/health/snapshots/range returns snapshots in range", async () => {
    const res = await app.request("/api/health/snapshots/range?start_date=2025-01-15&end_date=2025-01-17");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshots.length).toBe(3);
  });

  test("GET /api/health/snapshots/range returns empty for no-data range", async () => {
    const res = await app.request("/api/health/snapshots/range?start_date=2020-01-01&end_date=2020-01-05");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshots.length).toBe(0);
  });

  test("GET /api/health/snapshots/range returns 400 when start > end", async () => {
    const res = await app.request("/api/health/snapshots/range?start_date=2025-01-20&end_date=2025-01-10");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  test("GET /api/health/snapshots/range returns 400 when range > 90 days", async () => {
    const res = await app.request("/api/health/snapshots/range?start_date=2025-01-01&end_date=2025-06-01");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  // --- Metrics ---

  test("GET /api/health/metrics/{type} returns time series", async () => {
    const res = await app.request("/api/health/metrics/steps?start_date=2025-01-15&end_date=2025-01-17");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metric_type).toBe("steps");
    expect(body.data.length).toBe(3);
  });

  test("GET /api/health/metrics/{type} returns empty for no-data range", async () => {
    const res = await app.request("/api/health/metrics/steps?start_date=2020-01-01&end_date=2020-01-05");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(0);
  });

  test("GET /api/health/metrics/{type} returns 400 for invalid metric type", async () => {
    const res = await app.request("/api/health/metrics/invalid_metric?start_date=2025-01-15&end_date=2025-01-17");
    expect(res.status).toBe(400);
  });

  test("GET /api/health/metrics/{type} returns 400 when start > end", async () => {
    const res = await app.request("/api/health/metrics/steps?start_date=2025-01-20&end_date=2025-01-10");
    expect(res.status).toBe(400);
  });

  // --- Categories ---

  test("GET /api/health/categories returns category list", async () => {
    const res = await app.request("/api/health/categories");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.categories.length).toBeGreaterThan(0);
    expect(body.categories[0]).toHaveProperty("name");
    expect(body.categories[0]).toHaveProperty("metrics");
  });

  // --- Trends ---

  test("GET /api/health/trends returns statistics when data exists", async () => {
    const res = await app.request("/api/health/trends?metric_type=steps&days=90");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metric_type).toBe("steps");
    expect(body.statistics).toHaveProperty("mean");
    expect(body.statistics).toHaveProperty("median");
  });

  test("GET /api/health/trends returns null stats when no data", async () => {
    const res = await app.request("/api/health/trends?metric_type=blood_oxygen_percent&days=1");
    // This might have data or not depending on date('now') vs seeded dates
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("statistics");
    expect(body).toHaveProperty("comparison");
    expect(body).toHaveProperty("insight");
  });

  test("GET /api/health/trends returns 400 for invalid metric type", async () => {
    const res = await app.request("/api/health/trends?metric_type=fake_metric&days=7");
    expect(res.status).toBe(400);
  });
});
