import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { z } from "zod";

export function registerDashboardRoutes(app: OpenAPIApp, db: Database) {
  const listRoute = createRoute({
    method: "get",
    path: "/api/dashboard",
    summary: "List dashboard configs",
    responses: {
      200: { description: "List of dashboard configs" },
    },
  });

  app.openApiRoute(listRoute, (c) => {
    const rows = db.query("SELECT * FROM dashboard_config").all();
    return c.json({ data: rows });
  }, { auth: "required" });

  const detailRoute = createRoute({
    method: "get",
    path: "/api/dashboard/{id}",
    summary: "Get dashboard config detail",
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: { description: "Dashboard config detail" },
      404: { description: "Not found" },
    },
  });

  app.openApiRoute(detailRoute, (c) => {
    const id = Number(c.req.param("id"));
    const row = db.query("SELECT * FROM dashboard_config WHERE id = ?").get(id);
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json(row);
  }, { auth: "required" });
}
