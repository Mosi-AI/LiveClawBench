import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { err, getAuthUserId } from "../helpers";

export function registerUserRoutes(app: OpenAPIApp, db: Database): void {
  app.get("/api/users/search", async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json(err("Authentication required"), 401);

    const query = (c.req.query("q") ?? "").trim();

    if (!query) {
      return c.json({ users: [] });
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

    return c.json({ users });
  });
}
