import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { createTestApp, jsonRequest, cleanup } from "./setup";

describe("Admin API", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
  });

  afterEach(() => cleanup());

  test("POST /api/admin/health/snapshots/batch imports snapshots", async () => {
    const res = await jsonRequest(app, "/api/admin/health/snapshots/batch", {
      snapshots: [
        {
          snapshot_date: "2025-01-10",
          steps: 5000,
          active_energy_kcal: 200,
          sleep_hours: 7.0,
        },
        {
          snapshot_date: "2025-01-11",
          steps: 6000,
        },
      ],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.imported_count).toBe(2);
  });

  test("Batch-imported snapshots are queryable via snapshot endpoint", async () => {
    await jsonRequest(app, "/api/admin/health/snapshots/batch", {
      snapshots: [
        { snapshot_date: "2025-02-01", steps: 9000, weight_kg: 72.0 },
      ],
    });

    const res = await app.request("/api/health/snapshot?date=2025-02-01");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.steps).toBe(9000);
    expect(body.weight_kg).toBe(72.0);
  });

  test("Batch-imported snapshots populate metric series", async () => {
    await jsonRequest(app, "/api/admin/health/snapshots/batch", {
      snapshots: [
        { snapshot_date: "2025-03-01", steps: 7500 },
        { snapshot_date: "2025-03-02", steps: 8500 },
      ],
    });

    const res = await app.request(
      "/api/health/metrics/steps?start_date=2025-03-01&end_date=2025-03-02"
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(2);
  });

  test("POST /api/admin/medications/batch creates medications", async () => {
    const res = await jsonRequest(app, "/api/admin/medications/batch", {
      medications: [
        {
          name: "Vitamin D",
          frequency: "daily",
          start_date: "2025-01-01",
          slots: [
            { time_hhmm: "09:00", dose_amount: 1000, dose_unit: "IU" },
          ],
        },
        {
          name: "Pain Relief",
          frequency: "as_needed",
          start_date: "2025-01-01",
        },
      ],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.created_count).toBe(2);
  });

  test("Batch-created medications appear in medication list", async () => {
    await jsonRequest(app, "/api/admin/medications/batch", {
      medications: [
        {
          name: "TestMed",
          frequency: "daily",
          start_date: "2025-01-01",
          slots: [{ time_hhmm: "08:00", dose_amount: 50, dose_unit: "mg" }],
        },
      ],
    });

    const res = await app.request("/api/medications");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.medications.length).toBe(1);
    expect(body.medications[0].name).toBe("TestMed");
  });

  test("Admin endpoints blocked when NODE_ENV=production and MOCK_ADMIN_MODE unset", async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origAdminMode = process.env.MOCK_ADMIN_MODE;
    process.env.NODE_ENV = "production";
    delete process.env.MOCK_ADMIN_MODE;

    try {
      const res = await jsonRequest(app, "/api/admin/health/snapshots/batch", {
        snapshots: [{ snapshot_date: "2025-01-01", steps: 100 }],
      });
      expect(res.status).toBe(403);
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      if (origAdminMode !== undefined) {
        process.env.MOCK_ADMIN_MODE = origAdminMode;
      } else {
        delete process.env.MOCK_ADMIN_MODE;
      }
    }
  });

  test("Admin endpoints allowed when NODE_ENV=production and MOCK_ADMIN_MODE=1", async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origAdminMode = process.env.MOCK_ADMIN_MODE;
    process.env.NODE_ENV = "production";
    process.env.MOCK_ADMIN_MODE = "1";

    try {
      const res = await jsonRequest(app, "/api/admin/health/snapshots/batch", {
        snapshots: [{ snapshot_date: "2025-01-01", steps: 100 }],
      });
      expect(res.status).toBe(200);
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      if (origAdminMode !== undefined) {
        process.env.MOCK_ADMIN_MODE = origAdminMode;
      } else {
        delete process.env.MOCK_ADMIN_MODE;
      }
    }
  });
});
