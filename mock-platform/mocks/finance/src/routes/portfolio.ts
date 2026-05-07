import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { CreateOrderSchema } from "../schemas/portfolio";
import { parseFormBody } from "../utils";

export interface OrderResult {
  success: boolean;
  order?: Record<string, unknown>;
  error?: string;
}

export function executePortfolioOrder(
  db: Database,
  body: Record<string, unknown>
): OrderResult {
  const parse = CreateOrderSchema.safeParse(body);
  if (!parse.success) {
    return { success: false, error: "Invalid input" };
  }
  const { asset_class_code, direction, amount } = parse.data;

  let orderId: number;
  const tx = db.transaction(() => {
    const holding = db
      .query<{ current_value: number }, [string]>(
        "SELECT current_value FROM portfolio_holding WHERE asset_class_code = ?"
      )
      .get(asset_class_code);
    if (!holding) {
      throw new Error("Holding not found");
    }
    if (direction === "sell" && amount > holding.current_value) {
      throw new Error("Sell amount exceeds holding value");
    }

    db.run(
      `INSERT INTO portfolio_order (asset_class_code, direction, amount, status)
       VALUES (?, ?, ?, ?)`,
      [asset_class_code, direction, amount, "executed"]
    );
    orderId = Number(db.query<{ id: number }, []>("SELECT last_insert_rowid() AS id").get()!.id);
    const delta = direction === "buy" ? amount : -amount;
    db.run(
      `UPDATE portfolio_holding SET current_value = current_value + ? WHERE asset_class_code = ?`,
      [delta, asset_class_code]
    );
  });

  try {
    tx();
  } catch (e: any) {
    if (e.message === "Holding not found" || e.message === "Sell amount exceeds holding value") {
      return { success: false, error: e.message };
    }
    throw e;
  }

  const order = db
    .query("SELECT * FROM portfolio_order WHERE id = ?")
    .get(orderId!) as Record<string, unknown>;
  return { success: true, order };
}

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
      body = parseFormBody(await c.req.parseBody());
    }

    const result = executePortfolioOrder(db, body);
    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }
    return c.json(result.order, 201);
  }, { auth: "required" });
}
