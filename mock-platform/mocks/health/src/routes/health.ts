import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import { z } from "zod";
import {
  HealthSnapshotSchema,
  SnapshotQuerySchema,
  RangeQuerySchema,
  MetricsQuerySchema,
  MetricTypeSchema,
  MetricsResponseSchema,
  CategorySchema,
  TrendsQuerySchema,
  TrendsResponseSchema,
  ErrorResponseSchema,
} from "../schemas";
import { errorResponse } from "../utils/errors";
import { initDb } from "../db";
import { getToday } from "../utils/clock";

const CATEGORIES = [
  { name: "Fitness", icon: "fitness", metrics: ["steps", "active_energy_kcal"] },
  { name: "Sleep", icon: "sleep", metrics: ["sleep_hours", "sleep_quality", "light_sleep_hours", "deep_sleep_hours", "rem_sleep_hours"] },
  { name: "Activity", icon: "activity", metrics: ["low_intensity_min", "medium_intensity_min", "high_intensity_min", "total_activity_min"] },
  { name: "Heart", icon: "heart", metrics: ["resting_heart_rate_bpm", "avg_heart_rate_bpm"] },
  { name: "Body", icon: "body", metrics: ["weight_kg", "body_fat_percent"] },
  { name: "Blood Oxygen", icon: "oxygen", metrics: ["blood_oxygen_percent"] },
  { name: "Energy", icon: "energy", metrics: ["active_energy_kcal"] },
];

function validateDateRange(startDate: string, endDate: string): string | null {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "Invalid date format";
  if (start > end) return "Date range must be between 1 and 90 days";
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  if (diffDays > 90) return "Date range must be between 1 and 90 days";
  return null;
}

export function registerHealthRoutes(app: OpenAPIApp) {
  // GET /api/health/snapshot
  const snapshotRoute = createRoute({
    method: "get",
    path: "/api/health/snapshot",
    summary: "Get health snapshot for a date",
    request: { query: SnapshotQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: HealthSnapshotSchema } },
        description: "Health snapshot",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Validation error",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(snapshotRoute, (c) => {
    const { date } = c.req.valid("query");
    const targetDate = date || getToday();
    const db = initDb();
    const row = db.query("SELECT * FROM health_daily_snapshot WHERE user_id = 1 AND date = ?").get(targetDate) as any;
    if (!row) {
      return errorResponse(c, "NOT_FOUND", `No snapshot found for date ${targetDate}`);
    }
    return c.json(row);
  });

  // GET /api/health/snapshots/range
  const rangeRoute = createRoute({
    method: "get",
    path: "/api/health/snapshots/range",
    summary: "Get health snapshots for a date range",
    request: { query: RangeQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: z.object({ snapshots: z.array(HealthSnapshotSchema) }) } },
        description: "Snapshots in range",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Validation error",
      },
    },
  });

  app.openApiRoute(rangeRoute, (c) => {
    const { start_date, end_date } = c.req.valid("query");
    const rangeError = validateDateRange(start_date, end_date);
    if (rangeError) {
      return errorResponse(c, "VALIDATION_ERROR", rangeError);
    }
    const db = initDb();
    const rows = db.query(
      "SELECT * FROM health_daily_snapshot WHERE user_id = 1 AND date >= ? AND date <= ? ORDER BY date"
    ).all(start_date, end_date);
    return c.json({ snapshots: rows });
  });

  // GET /api/health/metrics/{type}
  const metricsRoute = createRoute({
    method: "get",
    path: "/api/health/metrics/{type}",
    summary: "Get time-series data for a health metric",
    request: {
      params: z.object({ type: MetricTypeSchema }),
      query: MetricsQuerySchema,
    },
    responses: {
      200: {
        content: { "application/json": { schema: MetricsResponseSchema } },
        description: "Metric time series",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Validation error",
      },
    },
  });

  app.openApiRoute(metricsRoute, (c) => {
    const { type } = c.req.valid("param");
    const { start_date, end_date } = c.req.valid("query");
    const rangeError = validateDateRange(start_date, end_date);
    if (rangeError) {
      return errorResponse(c, "VALIDATION_ERROR", rangeError);
    }
    const db = initDb();
    const rows = db.query(
      "SELECT date, value FROM health_metric_series WHERE user_id = 1 AND metric_type = ? AND date >= ? AND date <= ? ORDER BY date"
    ).all(type, start_date, end_date);
    return c.json({ metric_type: type, data: rows });
  });

  // GET /api/health/categories
  const categoriesRoute = createRoute({
    method: "get",
    path: "/api/health/categories",
    summary: "List health categories",
    responses: {
      200: {
        content: { "application/json": { schema: z.object({ categories: z.array(CategorySchema) }) } },
        description: "Category list",
      },
    },
  });

  app.openApiRoute(categoriesRoute, (c) => {
    return c.json({ categories: CATEGORIES });
  });

  // GET /api/health/trends
  const trendsRoute = createRoute({
    method: "get",
    path: "/api/health/trends",
    summary: "Get trend insights for a metric",
    request: { query: TrendsQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: TrendsResponseSchema } },
        description: "Trend analysis",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Validation error",
      },
    },
  });

  app.openApiRoute(trendsRoute, (c) => {
    const { metric_type, days } = c.req.valid("query");
    const db = initDb();
    const rows = db.query(
      `SELECT value FROM health_metric_series
       WHERE user_id = 1 AND metric_type = ? AND date >= date('now', '-' || ? || ' days')
       ORDER BY date`
    ).all(metric_type, days) as { value: number }[];

    if (rows.length === 0) {
      return c.json({
        metric_type,
        days,
        statistics: { mean: null, median: null, std_dev: null, min: null, max: null },
        comparison: { previous_period_mean: null, change_percent: null, trend: "stable" as const },
        insight: "Insufficient data for insights",
      });
    }

    const values = rows.map(r => r.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    const std_dev = Math.sqrt(variance);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    const prevRows = db.query(
      `SELECT value FROM health_metric_series
       WHERE user_id = 1 AND metric_type = ? AND date >= date('now', '-' || ? || ' days') AND date < date('now', '-' || ? || ' days')
       ORDER BY date`
    ).all(metric_type, days * 2, days) as { value: number }[];

    let previous_period_mean: number | null = null;
    let change_percent: number | null = null;
    let trend: "rising" | "falling" | "stable" = "stable";

    if (prevRows.length > 0) {
      const prevValues = prevRows.map(r => r.value);
      previous_period_mean = prevValues.reduce((a, b) => a + b, 0) / prevValues.length;
      if (previous_period_mean !== 0) {
        change_percent = +((mean - previous_period_mean) / previous_period_mean * 100).toFixed(1);
        trend = change_percent > 5 ? "rising" : change_percent < -5 ? "falling" : "stable";
      }
    }

    const insight = trend === "rising"
      ? `${metric_type} has been rising over the past ${days} days`
      : trend === "falling"
        ? `${metric_type} has been falling over the past ${days} days`
        : `${metric_type} has been stable over the past ${days} days`;

    return c.json({
      metric_type,
      days,
      statistics: {
        mean: +mean.toFixed(2),
        median: +median.toFixed(2),
        std_dev: +std_dev.toFixed(2),
        min: +min.toFixed(2),
        max: +max.toFixed(2),
      },
      comparison: { previous_period_mean: previous_period_mean ? +previous_period_mean.toFixed(2) : null, change_percent, trend },
      insight,
    });
  });
}
