import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { ok, err, paginate, parsePageParams } from "../helpers";

export function registerAnnouncementRoutes(app: OpenAPIApp, db: Database): void {
  // GET /api/announcements
  app.get("/api/announcements", (c) => {
    const query = c.req.query();
    const { page, perPage, offset } = parsePageParams(query.page, query.per_page);
    const category = query.category;

    let sql = "SELECT * FROM announcements WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))";
    const params: (string | number)[] = [];

    if (category) {
      sql += " AND category = ?";
      params.push(category);
    }

    const countRow = db.query(`SELECT COUNT(*) as total FROM (${sql})`).get(...params) as { total: number };
    const items = db.query(`${sql} ORDER BY published_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset) as Record<string, unknown>[];

    return c.json(ok(paginate(items, countRow.total, page, perPage, "announcements")));
  });

  // GET /api/announcements/:announcement_id
  app.get("/api/announcements/:announcement_id", (c) => {
    const id = parseInt(c.req.param("announcement_id"), 10);
    const item = db.query("SELECT * FROM announcements WHERE id = ?").get(id) as Record<string, unknown> | null;
    if (!item) return c.json(err("Announcement not found"), 404);
    return c.json(ok(item));
  });
}
