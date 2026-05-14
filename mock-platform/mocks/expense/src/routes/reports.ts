import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import { z } from "zod";
import { getExpenseDb } from "../utils/db.js";
import {
  SpendOverTimeQuerySchema, SpendOverTimeResponseSchema,
  TopCategoriesQuerySchema, TopCategoriesResponseSchema,
  TopMerchantsQuerySchema, TopMerchantsResponseSchema,
} from "../schemas.js";

const STATUS_FILTER = "('submitted', 'approved', 'reimbursed')";

function getDateRange(query: { from?: string; to?: string }): { from: string; to: string } {
  return {
    from: query.from || "2020-01-01",
    to: query.to || new Date().toISOString().split("T")[0],
  };
}

function calcPercentage(amount: number, total: number): number {
  return total > 0 ? (amount / total) * 100 : 0;
}

export function registerReportRoutes(app: OpenAPIApp): void {
  // GET /api/reports/spend-over-time
  const spendRoute = createRoute({
    method: "get",
    path: "/api/reports/spend-over-time",
    summary: "Time-series aggregation",
    request: { query: SpendOverTimeQuerySchema },
    responses: {
      200: { content: { "application/json": { schema: SpendOverTimeResponseSchema } }, description: "Spend data" },
    },
  });

  app.openApiRoute(spendRoute, async (c) => {
    const query = c.req.valid("query");
    const userId = c.var.userId as number;
    const db = getExpenseDb();
    const { from, to } = getDateRange(query);

    const rows = db.query(
      `SELECT
        CASE ?
          WHEN 'day' THEN invoice_date
          WHEN 'week' THEN strftime('%Y-W%W', invoice_date)
          WHEN 'month' THEN strftime('%Y-%m', invoice_date)
        END as period,
        SUM(amount) as total_amount,
        COUNT(*) as count
       FROM expense_draft
       WHERE user_id = ?
         AND status IN ${STATUS_FILTER}
         AND currency = ?
         AND invoice_date BETWEEN ? AND ?
       GROUP BY period
       ORDER BY period`,
    ).all(query.group_by, userId, query.currency, from, to) as Record<string, unknown>[];

    const totalSpend = rows.reduce((s, r) => s + (r.total_amount as number), 0);
    const totalExpenses = rows.reduce((s, r) => s + (r.count as number), 0);

    return c.json({
      data: rows.map((r) => ({
        period: r.period as string, total_amount: r.total_amount as number,
        count: r.count as number, currency: query.currency,
      })),
      currency: query.currency, total_spend: totalSpend, total_expenses: totalExpenses,
    });
  }, { auth: "required" });

  // GET /api/reports/top-categories
  const categoryRoute = createRoute({
    method: "get",
    path: "/api/reports/top-categories",
    summary: "Category aggregation",
    request: { query: TopCategoriesQuerySchema },
    responses: {
      200: { content: { "application/json": { schema: TopCategoriesResponseSchema } }, description: "Category data" },
    },
  });

  app.openApiRoute(categoryRoute, async (c) => {
    const query = c.req.valid("query");
    const userId = c.var.userId as number;
    const db = getExpenseDb();
    const { from, to } = getDateRange(query);

    const rows = db.query(
      `SELECT category, SUM(amount) as total_amount, COUNT(*) as count
       FROM expense_draft
       WHERE user_id = ?
         AND status IN ${STATUS_FILTER}
         AND currency = ? AND invoice_date BETWEEN ? AND ?
         AND category IS NOT NULL
       GROUP BY category
       ORDER BY total_amount DESC`,
    ).all(userId, query.currency, from, to) as Record<string, unknown>[];

    const totalSpend = rows.reduce((s, r) => s + (r.total_amount as number), 0);

    return c.json({
      data: rows.map((r) => ({
        category: r.category as string, total_amount: r.total_amount as number,
        count: r.count as number, percentage: calcPercentage(r.total_amount as number, totalSpend),
      })),
      currency: query.currency, total_spend: totalSpend,
    });
  }, { auth: "required" });

  // GET /api/reports/top-merchants
  const merchantRoute = createRoute({
    method: "get",
    path: "/api/reports/top-merchants",
    summary: "Merchant aggregation",
    request: { query: TopMerchantsQuerySchema },
    responses: {
      200: { content: { "application/json": { schema: TopMerchantsResponseSchema } }, description: "Merchant data" },
    },
  });

  app.openApiRoute(merchantRoute, async (c) => {
    const query = c.req.valid("query");
    const userId = c.var.userId as number;
    const db = getExpenseDb();
    const { from, to } = getDateRange(query);

    const rows = db.query(
      `SELECT vendor_name, SUM(amount) as total_amount, COUNT(*) as count
       FROM expense_draft
       WHERE user_id = ?
         AND status IN ${STATUS_FILTER}
         AND currency = ? AND invoice_date BETWEEN ? AND ?
       GROUP BY vendor_name
       ORDER BY total_amount DESC
       LIMIT ?`,
    ).all(userId, query.currency, from, to, query.limit) as Record<string, unknown>[];

    const totalSpend = rows.reduce((s, r) => s + (r.total_amount as number), 0);

    return c.json({
      data: rows.map((r) => ({
        vendor_name: r.vendor_name as string, total_amount: r.total_amount as number,
        count: r.count as number, percentage: calcPercentage(r.total_amount as number, totalSpend),
      })),
      currency: query.currency, total_spend: totalSpend,
    });
  }, { auth: "required" });
}
