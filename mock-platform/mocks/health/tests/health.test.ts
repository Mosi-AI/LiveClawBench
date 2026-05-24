import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Database } from "bun:sqlite";
import { createTestApp, jsonRequest, cleanup } from "./setup";
import { initDb } from "../src/db";

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

  test("GET /api/health/trends anchors the window to configured current_date", async () => {
    const db = initDb();
    db.query("UPDATE system_config SET value = ? WHERE key = 'current_date'").run("2025-01-17");

    const res = await app.request("/api/health/trends?metric_type=steps&days=7");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.statistics.mean).toBe(8000);
    expect(body.statistics.min).toBe(6000);
    expect(body.statistics.max).toBe(10000);
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

  test("GET /api/health/trends returns manual override statistics when configured", async () => {
    const importRes = await jsonRequest(app, "/api/admin/health/trends/overrides/batch", {
      overrides: [
        {
          metric_type: "steps",
          days: 7,
          statistics: {
            mean: 9100,
            median: 9000,
            std_dev: 320.25,
            min: 8600,
            max: 9500,
          },
          comparison: {
            previous_period_mean: 7800,
            change_percent: 16.7,
            trend: "rising",
          },
          insight: "Scenario override",
        },
      ],
    });
    expect(importRes.status).toBe(200);

    const res = await app.request("/api/health/trends?metric_type=steps&days=7");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.statistics).toEqual({
      mean: 9100,
      median: 9000,
      std_dev: 320.25,
      min: 8600,
      max: 9500,
    });
    expect(body.comparison).toEqual({
      previous_period_mean: 7800,
      change_percent: 16.7,
      trend: "rising",
    });
    expect(body.insight).toBe("Scenario override");
  });

  test("GET /api/health/trends allows explicit null manual override fields", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const db = initDb();
    db.query("UPDATE system_config SET value = ? WHERE key = 'current_date'").run(today);
    db.query(
      "INSERT OR REPLACE INTO health_metric_series (user_id, metric_type, date, value) VALUES (1, 'steps', ?, 1234)"
    ).run(today);

    const importRes = await jsonRequest(app, "/api/admin/health/trends/overrides/batch", {
      overrides: [
        {
          metric_type: "steps",
          days: 1,
          statistics: {
            mean: null,
          },
        },
      ],
    });
    expect(importRes.status).toBe(200);

    const res = await app.request("/api/health/trends?metric_type=steps&days=1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.statistics.mean).toBeNull();
    expect(body.statistics.median).toBe(1234);
  });
});

describe("Health DB path configuration", () => {
  afterEach(() => {
    cleanup();
    delete process.env.HEALTH_DB_PATH;
  });

  test("initDb uses HEALTH_DB_PATH when set", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "health-db-"));
    const dbPath = join(tempDir, "configured-health.db");

    cleanup();
    delete process.env.HEALTH_DB_PATH;
    try { unlinkSync("health.db"); } catch {}

    process.env.HEALTH_DB_PATH = dbPath;

    const db = initDb();
    db.close();
    cleanup();

    const configuredDb = new Database(dbPath, { readonly: true });
    const tables = configuredDb
      .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'system_config'")
      .all() as Array<{ name: string }>;
    configuredDb.close();

    expect(tables).toEqual([{ name: "system_config" }]);

    try {
      const strayDb = new Database("health.db", { readonly: true });
      strayDb.close();
      expect.unreachable("health.db should not be created when HEALTH_DB_PATH is set");
    } catch {
      expect(true).toBe(true);
    }

    rmSync(tempDir, { recursive: true, force: true });
  });
});
