import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { ok } from "../helpers";

export function registerUserRoutes(app: OpenAPIApp, db: Database): void {
  // GET /api/users/search?q=
  app.get("/api/users/search", async (c) => {
    const query = (c.req.query("q") ?? "").trim();

    if (!query) {
      return c.json(ok({ users: [] }));
    }

    const pattern = `%${query}%`;
    const rows = db.query(
      `SELECT id, username, email, created_at FROM users
       WHERE username LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\'
       LIMIT 10`
    ).all(pattern, pattern) as Record<string, unknown>[];

    const users = rows.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      created_at: u.created_at,
    }));

    return c.json(ok({ users }));
  });
}
