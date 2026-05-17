import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { z } from "zod";
import { IdParamSchema } from "../schemas/common";

export function registerTransactionRoutes(app: OpenAPIApp, db: Database) {
  const listRoute = createRoute({
    method: "get",
    path: "/api/transactions",
    summary: "List transactions",
    request: {
      query: z.object({
        status: z.string().optional(),
        category: z.string().optional(),
        vendor: z.string().optional(),
      }),
    },
    responses: {
      200: { description: "List of transactions" },
    },
  });

  app.openApiRoute(listRoute, (c) => {
    const status = c.req.query("status");
    const category = c.req.query("category");
    const vendor = c.req.query("vendor");

    let sql = "SELECT * FROM transaction_record WHERE 1=1";
    const params: (string | number)[] = [];

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }
    if (category) {
      sql += " AND category = ?";
      params.push(category);
    }
    if (vendor) {
      sql += " AND vendor_name = ?";
      params.push(vendor);
    }

    const rows = db.query(sql).all(...params);
    return c.json({ data: rows });
  }, { auth: "required" });

  const detailRoute = createRoute({
    method: "get",
    path: "/api/transactions/{id}",
    summary: "Get transaction detail",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: { description: "Transaction detail" },
      404: { description: "Not found" },
    },
  });

  app.openApiRoute(detailRoute, (c) => {
    const id = Number(c.req.param("id"));
    const row = db
      .query("SELECT * FROM transaction_record WHERE id = ?")
      .get(id);
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json(row);
  }, { auth: "required" });

  const flagRoute = createRoute({
    method: "post",
    path: "/api/transactions/{id}/flag",
    summary: "Flag transaction",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: { description: "Flagged" },
      404: { description: "Not found" },
    },
  });

  app.openApiRoute(flagRoute, (c) => {
    const id = Number(c.req.param("id"));
    db.run(
      "UPDATE transaction_record SET status = 'flagged', updated_at = datetime('now') WHERE id = ?",
      [id]
    );
    const row = db
      .query("SELECT id, status FROM transaction_record WHERE id = ?")
      .get(id);
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json(row);
  }, { auth: "required" });
}
