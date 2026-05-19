import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { IdParamSchema } from "../schemas/common";

export function registerAccountRoutes(app: OpenAPIApp, db: Database) {
  const listRoute = createRoute({
    method: "get",
    path: "/api/accounts",
    summary: "List accounts",
    responses: {
      200: { description: "List of account balances" },
    },
  });

  app.openApiRoute(listRoute, (c) => {
    const rows = db.query("SELECT * FROM account_balance").all();
    return c.json({ data: rows });
  }, { auth: "required" });

  const transactionsRoute = createRoute({
    method: "get",
    path: "/api/accounts/{id}/transactions",
    summary: "Get account transactions",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: { description: "Account transactions" },
    },
  });

  app.openApiRoute(transactionsRoute, (c) => {
    const id = Number(c.req.param("id"));
    const rows = db
      .query("SELECT * FROM account_transaction WHERE account_balance_id = ?")
      .all(id);
    return c.json({ data: rows });
  }, { auth: "required" });

  const flagRoute = createRoute({
    method: "post",
    path: "/api/accounts/{id}/flag",
    summary: "Flag account",
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
      "UPDATE account_balance SET status = 'flagged', updated_at = datetime('now') WHERE id = ?",
      [id]
    );
    const row = db
      .query("SELECT id, status FROM account_balance WHERE id = ?")
      .get(id);
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json(row);
  }, { auth: "required" });
}
