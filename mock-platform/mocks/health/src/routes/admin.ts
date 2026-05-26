import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import { z } from "zod";
import {
  BatchSnapshotsBodySchema,
  BatchTrendOverridesBodySchema,
  BatchMedicationsBodySchema,
  ErrorResponseSchema,
} from "../schemas";
import { errorResponse } from "../utils/errors";
import { initDb } from "../db";
import { getNow } from "../utils/clock";

function isAdminAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.MOCK_ADMIN_MODE === "1"
  );
}

export function registerAdminRoutes(app: OpenAPIApp) {
  const batchSnapshotsRoute = createRoute({
    method: "post",
    path: "/api/admin/health/snapshots/batch",
    summary: "Batch import health snapshots",
    request: {
      body: { content: { "application/json": { schema: BatchSnapshotsBodySchema } } },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean(), imported_count: z.number() }),
          },
        },
        description: "Import successful",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Validation error",
      },
      403: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Forbidden",
      },
    },
  });

  app.openApiRoute(batchSnapshotsRoute, (c) => {
    if (!isAdminAllowed()) {
      return errorResponse(c, "FORBIDDEN", "Admin endpoints are disabled in production");
    }
    const { snapshots } = c.req.valid("json");
    const db = initDb();
    let imported = 0;
    for (const s of snapshots) {
      db.query(
        `INSERT OR REPLACE INTO health_daily_snapshot
         (user_id, date, steps, active_energy_kcal, sleep_hours, sleep_quality,
          resting_heart_rate_bpm, avg_heart_rate_bpm, weight_kg, body_fat_percent, blood_oxygen_percent)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        s.snapshot_date,
        s.steps ?? null, s.active_energy_kcal ?? null,
        s.sleep_hours ?? null, s.sleep_quality ?? null,
        s.resting_heart_rate_bpm ?? null, s.avg_heart_rate_bpm ?? null,
        s.weight_kg ?? null, s.body_fat_percent ?? null, s.blood_oxygen_percent ?? null
      );
      const metricMap: Record<string, number | null | undefined> = {
        steps: s.steps, active_energy_kcal: s.active_energy_kcal,
        sleep_hours: s.sleep_hours, resting_heart_rate_bpm: s.resting_heart_rate_bpm,
        avg_heart_rate_bpm: s.avg_heart_rate_bpm, weight_kg: s.weight_kg,
        body_fat_percent: s.body_fat_percent, blood_oxygen_percent: s.blood_oxygen_percent,
      };
      for (const [type, value] of Object.entries(metricMap)) {
        if (value != null) {
          db.query(
            `INSERT OR REPLACE INTO health_metric_series (user_id, metric_type, date, value) VALUES (1, ?, ?, ?)`
          ).run(type, s.snapshot_date, value);
        }
      }
      imported++;
    }
    return c.json({ success: true, imported_count: imported });
  });

  const batchTrendOverridesRoute = createRoute({
    method: "post",
    path: "/api/admin/health/trends/overrides/batch",
    summary: "Batch import manual trend overrides",
    request: {
      body: { content: { "application/json": { schema: BatchTrendOverridesBodySchema } } },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean(), imported_count: z.number() }),
          },
        },
        description: "Import successful",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Validation error",
      },
      403: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Forbidden",
      },
    },
  });

  app.openApiRoute(batchTrendOverridesRoute, (c) => {
    if (!isAdminAllowed()) {
      return errorResponse(c, "FORBIDDEN", "Admin endpoints are disabled in production");
    }
    const { overrides } = c.req.valid("json");
    const db = initDb();
    let imported = 0;
    for (const override of overrides) {
      const statistics = override.statistics;
      const comparison = override.comparison;
      db.query(
        `INSERT INTO health_trend_override
         (user_id, metric_type, days, mean, median, std_dev, min, max,
          previous_period_mean, change_percent, trend, insight,
          has_mean, has_median, has_std_dev, has_min, has_max,
          has_previous_period_mean, has_change_percent, has_trend, has_insight,
          updated_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, metric_type, days) DO UPDATE SET
           mean = excluded.mean,
           median = excluded.median,
           std_dev = excluded.std_dev,
           min = excluded.min,
           max = excluded.max,
           previous_period_mean = excluded.previous_period_mean,
           change_percent = excluded.change_percent,
           trend = excluded.trend,
           insight = excluded.insight,
           has_mean = excluded.has_mean,
           has_median = excluded.has_median,
           has_std_dev = excluded.has_std_dev,
           has_min = excluded.has_min,
           has_max = excluded.has_max,
           has_previous_period_mean = excluded.has_previous_period_mean,
           has_change_percent = excluded.has_change_percent,
           has_trend = excluded.has_trend,
           has_insight = excluded.has_insight,
           updated_at = excluded.updated_at`
      ).run(
        override.metric_type,
        override.days,
        statistics?.mean ?? null,
        statistics?.median ?? null,
        statistics?.std_dev ?? null,
        statistics?.min ?? null,
        statistics?.max ?? null,
        comparison?.previous_period_mean ?? null,
        comparison?.change_percent ?? null,
        comparison?.trend ?? null,
        override.insight ?? null,
        Number(Object.prototype.hasOwnProperty.call(statistics ?? {}, "mean")),
        Number(Object.prototype.hasOwnProperty.call(statistics ?? {}, "median")),
        Number(Object.prototype.hasOwnProperty.call(statistics ?? {}, "std_dev")),
        Number(Object.prototype.hasOwnProperty.call(statistics ?? {}, "min")),
        Number(Object.prototype.hasOwnProperty.call(statistics ?? {}, "max")),
        Number(Object.prototype.hasOwnProperty.call(comparison ?? {}, "previous_period_mean")),
        Number(Object.prototype.hasOwnProperty.call(comparison ?? {}, "change_percent")),
        Number(Object.prototype.hasOwnProperty.call(comparison ?? {}, "trend")),
        Number(Object.prototype.hasOwnProperty.call(override, "insight")),
        getNow(),
      );
      imported++;
    }
    return c.json({ success: true, imported_count: imported });
  });

  const batchMedicationsRoute = createRoute({
    method: "post",
    path: "/api/admin/medications/batch",
    summary: "Batch create medications",
    request: {
      body: { content: { "application/json": { schema: BatchMedicationsBodySchema } } },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean(), created_count: z.number() }),
          },
        },
        description: "Batch create successful",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Validation error",
      },
      403: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Forbidden",
      },
    },
  });

  app.openApiRoute(batchMedicationsRoute, (c) => {
    if (!isAdminAllowed()) {
      return errorResponse(c, "FORBIDDEN", "Admin endpoints are disabled in production");
    }
    const { medications } = c.req.valid("json");
    const db = initDb();
    const now = getNow();
    let created = 0;
    for (const m of medications) {
      const med = db.query(
        "INSERT INTO medication (user_id, name, display_name, frequency, start_date, end_date, notes, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"
      ).get(m.name, m.display_name ?? null, m.frequency, m.start_date, m.end_date ?? null, m.notes ?? null, now, now) as any;
      for (const s of m.slots ?? []) {
        db.query(
          "INSERT INTO medication_intake_slot (medication_id, time_hhmm, dose_amount, dose_unit, label) VALUES (?, ?, ?, ?, ?)"
        ).run(med.id, s.time_hhmm, s.dose_amount, s.dose_unit, s.label ?? null);
      }
      created++;
    }
    return c.json({ success: true, created_count: created });
  });
}
