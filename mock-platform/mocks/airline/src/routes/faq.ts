import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { ok, err } from "../helpers";

export function registerFaqRoutes(app: OpenAPIApp, db: Database): void {
  // GET /api/faq
  app.get("/api/faq", (c) => {
    const category = c.req.query("category");
    let sql = "SELECT * FROM faqs WHERE is_active = 1";
    const params: string[] = [];

    if (category) {
      sql += " AND category = ?";
      params.push(category);
    }

    const items = db.query(`${sql} ORDER BY display_order, id`).all(...params) as Record<string, unknown>[];
    return c.json(ok({ faqs: items }));
  });

  // GET /api/faq/:faq_id
  app.get("/api/faq/:faq_id", (c) => {
    const id = parseInt(c.req.param("faq_id"), 10);
    const item = db.query("SELECT * FROM faqs WHERE id = ?").get(id) as Record<string, unknown> | null;
    if (!item) return c.json(err("FAQ not found"), 404);
    return c.json(ok(item));
  });
}
