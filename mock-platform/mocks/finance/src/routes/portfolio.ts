import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { CreateOrderSchema } from "../schemas/portfolio";

export function registerPortfolioRoutes(app: OpenAPIApp, db: Database) {
  const getRoute = createRoute({
    method: "get",
    path: "/api/portfolio",
    summary: "Get portfolio holdings",
    responses: {
      200: { description: "Portfolio holdings with total value" },
    },
  });

  app.openApiRoute(getRoute, (c) => {
    const rows = db
      .query("SELECT * FROM portfolio_holding ORDER BY asset_class_code")
      .all() as Array<{ asset_class_code: string; asset_name: string; current_value: number }>;
    const total_value = rows.reduce((sum, r) => sum + (r.current_value ?? 0), 0);
    return c.json({ holdings: rows, total_value });
  }, { auth: "required" });

  const postRoute = createRoute({
    method: "post",
    path: "/api/portfolio/orders",
    summary: "Create portfolio order",
    responses: {
      201: { description: "Order created and holding updated" },
      400: { description: "Invalid request" },
    },
  });

  app.openApiRoute(postRoute, async (c) => {
    let body: Record<string, unknown>;
    const contentType = c.req.header("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = await c.req.json();
    } else {
      const form = await c.req.parseBody();
      body = Object.fromEntries(Object.entries(form));
      if (typeof body.amount === "string") {
        const num = Number(body.amount);
        body.amount = isNaN(num) ? body.amount : num;
      }
    }
    const parse = CreateOrderSchema.safeParse(body);
    if (!parse.success) {
      return c.json({ error: "Invalid input", details: parse.error.format() }, 400);
    }
    const { asset_class_code, direction, amount } = parse.data;

    const holding = db
      .query<{ current_value: number }, [string]>(
        "SELECT current_value FROM portfolio_holding WHERE asset_class_code = ?"
      )
      .get(asset_class_code);
    if (!holding) {
      return c.json({ error: "Holding not found" }, 400);
    }
    if (direction === "sell" && amount > holding.current_value) {
      return c.json({ error: "Sell amount exceeds holding value" }, 400);
    }

    const tx = db.transaction(() => {
      db.run(
        `INSERT INTO portfolio_order (asset_class_code, direction, amount, status)
         VALUES (?, ?, ?, ?)`,
        [asset_class_code, direction, amount, "executed"]
      );
      const delta = direction === "buy" ? amount : -amount;
      db.run(
        `UPDATE portfolio_holding SET current_value = current_value + ? WHERE asset_class_code = ?`,
        [delta, asset_class_code]
      );
    });
    tx();

    const order = db.query("SELECT * FROM portfolio_order ORDER BY id DESC LIMIT 1").get();
    return c.json(order, 201);
  }, { auth: "required" });
}
