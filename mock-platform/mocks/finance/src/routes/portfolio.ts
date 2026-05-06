import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { z } from "zod";

export function registerPortfolioRoutes(app: OpenAPIApp, db: Database) {
  const holdingsRoute = createRoute({
    method: "get",
    path: "/api/portfolio/holdings",
    summary: "List portfolio holdings",
    responses: {
      200: { description: "List of portfolio holdings" },
    },
  });

  app.openApiRoute(holdingsRoute, (c) => {
    const rows = db.query("SELECT * FROM portfolio_holding").all();
    return c.json({ data: rows });
  }, { auth: "required" });

  const ordersRoute = createRoute({
    method: "get",
    path: "/api/portfolio/orders",
    summary: "List portfolio orders",
    responses: {
      200: { description: "List of portfolio orders" },
    },
  });

  app.openApiRoute(ordersRoute, (c) => {
    const rows = db.query("SELECT * FROM portfolio_order").all();
    return c.json({ data: rows });
  }, { auth: "required" });

  const createOrderRoute = createRoute({
    method: "post",
    path: "/api/portfolio/orders",
    summary: "Create portfolio order",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              asset_class_code: z.string(),
              direction: z.string(),
              amount: z.number(),
            }),
          },
        },
      },
    },
    responses: {
      201: { description: "Order created" },
    },
  });

  app.openApiRoute(createOrderRoute, async (c) => {
    const body = await c.req.json();
    db.run(
      `INSERT INTO portfolio_order (asset_class_code, direction, amount, status)
       VALUES (?, ?, ?, ?)`,
      [body.asset_class_code, body.direction, body.amount, "submitted"]
    );
    const row = db.query("SELECT * FROM portfolio_order ORDER BY id DESC LIMIT 1").get();
    return c.json(row, 201);
  }, { auth: "required" });
}
