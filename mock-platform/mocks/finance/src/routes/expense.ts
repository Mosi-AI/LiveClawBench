import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { z } from "zod";
import { ExpenseCreateSchema, ExpenseSubmitResponseSchema } from "../schemas/expense";
import { IdParamSchema } from "../schemas/common";
import { round2 } from "../utils";

export function registerExpenseRoutes(app: OpenAPIApp, db: Database) {
  const createRouteDef = createRoute({
    method: "post",
    path: "/api/expense-reports",
    summary: "Create expense report",
    request: {
      body: {
        content: {
          "application/json": { schema: ExpenseCreateSchema },
        },
      },
    },
    responses: {
      200: { description: "Created" },
      400: { description: "Bad request" },
    },
  });

  app.openApiRoute(createRouteDef, async (c) => {
    const body = await c.req.json();
    const { trip_name, items } = body;

    if (!items || items.length === 0) {
      return c.json({ error: "At least one expense item is required" }, 400);
    }

    const userId = c.var.userId ?? 1;
    const total = items.reduce((s: number, item: { amount: number }) => s + item.amount, 0);

    const tx = db.transaction(() => {
      const result = db.run(
        "INSERT INTO expense_report (trip_name, total_amount, status, created_by_user_id) VALUES (?, ?, 'draft', ?)",
        [trip_name, round2(total), userId]
      );
      const reportId = result.lastInsertRowid;

      for (const item of items) {
        db.run(
          "INSERT INTO expense_item (expense_report_id, expense_category, amount) VALUES (?, ?, ?)",
          [reportId, item.expense_category, round2(item.amount)]
        );
      }
      return reportId;
    });

    const reportId = tx();
    const row = db
      .query("SELECT * FROM expense_report WHERE id = ?")
      .get(Number(reportId));
    return c.json(row);
  }, { auth: "required" });

  const submitRoute = createRoute({
    method: "post",
    path: "/api/expense-reports/{id}/submit",
    summary: "Submit expense report",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        description: "Submitted",
        content: { "application/json": { schema: ExpenseSubmitResponseSchema } },
      },
      404: { description: "Not found" },
    },
  });

  app.openApiRoute(submitRoute, (c) => {
    const id = Number(c.req.param("id"));
    const existing = db
      .query("SELECT id FROM expense_report WHERE id = ?")
      .get(id);
    if (!existing) return c.json({ error: "Not found" }, 404);

    db.run(
      "UPDATE expense_report SET status = 'submitted', updated_at = datetime('now') WHERE id = ?",
      [id]
    );
    const row = db
      .query("SELECT id, status FROM expense_report WHERE id = ?")
      .get(id);
    return c.json(row);
  }, { auth: "required" });
}
