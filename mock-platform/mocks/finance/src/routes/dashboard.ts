import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { DashboardConfigSchema } from "../schemas/dashboard";
import { computeDashboardMetrics, parseAndValidateFormula } from "../db/queries/dashboard";

export interface DashboardConfigRow {
  id: number;
  user_id: number;
  date_range_start: string;
  date_range_end: string;
  formula_json: string;
  department_weight_json: string;
}

function isValidWeights(value: unknown): value is Record<string, number> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  for (const v of Object.values(value)) {
    if (typeof v !== "number") return false;
  }
  return true;
}

export function validateDashboardConfig(row: { date_range_start: string; date_range_end: string; formula_json: string; department_weight_json: string }): string | null {
  if (row.date_range_start > row.date_range_end) {
    return "Invalid date range";
  }
  const formulaCheck = parseAndValidateFormula(row.formula_json);
  if (formulaCheck.error) {
    return formulaCheck.error;
  }
  try {
    const parsed = JSON.parse(row.department_weight_json || "{}");
    if (!isValidWeights(parsed)) {
      return "Invalid department weights: must be an object with numeric values";
    }
  } catch {
    return "Invalid department weights JSON";
  }
  return null;
}

function fetchConfig(db: Database, userId: number): DashboardConfigRow | null {
  return db
    .query<DashboardConfigRow, [number]>("SELECT * FROM dashboard_config WHERE user_id = ?")
    .get(userId);
}

export function getEffectiveConfig(db: Database, userId: number): DashboardConfigRow {
  const userConfig = fetchConfig(db, userId);
  if (userConfig && !validateDashboardConfig(userConfig)) return userConfig;

  const admin = db
    .query<{ id: number }, []>("SELECT id FROM user WHERE role = 'admin' ORDER BY id LIMIT 1")
    .get();
  if (admin) {
    const adminConfig = fetchConfig(db, admin.id);
    if (adminConfig && !validateDashboardConfig(adminConfig)) return adminConfig;
  }

  return {
    id: 0,
    user_id: userId,
    date_range_start: "2026-01-01",
    date_range_end: "2026-12-31",
    formula_json: "{}",
    department_weight_json: "{}",
  };
}

export function registerDashboardRoutes(app: OpenAPIApp, db: Database) {
  const getRoute = createRoute({
    method: "get",
    path: "/api/dashboard",
    summary: "Get dashboard data",
    responses: {
      200: { description: "Dashboard KPIs and trend data" },
    },
  });

  app.openApiRoute(getRoute, (c) => {
    const userId = c.var.userId as number;
    const config = getEffectiveConfig(db, userId);
    const metrics = computeDashboardMetrics(db, config);
    return c.json({
      config: {
        date_range_start: config.date_range_start,
        date_range_end: config.date_range_end,
        formula_json: config.formula_json,
        department_weight_json: config.department_weight_json,
      },
      kpis: metrics.kpis,
      monthly: metrics.monthly,
    });
  }, { auth: "required" });

  const postRoute = createRoute({
    method: "post",
    path: "/api/dashboard/config",
    summary: "Update dashboard config",
    responses: {
      200: { description: "Config updated" },
      400: { description: "Invalid input" },
      403: { description: "Forbidden" },
    },
  });

  app.openApiRoute(postRoute, async (c) => {
    const userId = c.var.userId as number;
    const user = db.query<{ role: string }, [number]>("SELECT role FROM user WHERE id = ?").get(userId);
    if (!user || user.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }

    let body: Record<string, unknown>;
    const contentType = c.req.header("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = await c.req.json();
    } else {
      const form = await c.req.parseBody();
      body = Object.fromEntries(Object.entries(form));
    }

    const parse = DashboardConfigSchema.safeParse(body);
    if (!parse.success) {
      return c.json({ error: "Invalid input", details: parse.error.format() }, 400);
    }
    const { date_range_start, date_range_end, formula_json, department_weight_json } = parse.data;

    const configError = validateDashboardConfig({ date_range_start, date_range_end, formula_json, department_weight_json });
    if (configError) {
      return c.json({ error: configError }, 400);
    }

    db.run(
      `INSERT INTO dashboard_config (user_id, date_range_start, date_range_end, formula_json, department_weight_json)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         date_range_start = excluded.date_range_start,
         date_range_end = excluded.date_range_end,
         formula_json = excluded.formula_json,
         department_weight_json = excluded.department_weight_json`,
      [userId, date_range_start, date_range_end, formula_json, department_weight_json]
    );

    return c.json({ success: true });
  }, { auth: "required" });
}
