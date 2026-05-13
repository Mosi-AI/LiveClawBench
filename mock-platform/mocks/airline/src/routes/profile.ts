import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { ok, err, getUserById } from "../helpers";

export function registerProfileRoutes(app: OpenAPIApp, db: Database): void {
  // GET /api/profile
  app.get("/api/profile", (c) => {
    const userId = c.get("userId")!;
    const user = getUserById(db, userId);
    if (!user) return c.json(err("User not found"), 404);
    return c.json(ok(user));
  });

  // PUT /api/profile
  app.put("/api/profile", async (c) => {
    const userId = c.get("userId")!;
    const body = (await c.req.json()) as Record<string, unknown>;
    const fields: string[] = [];
    const values: (string | null)[] = [];

    if (body.first_name !== undefined) { fields.push("first_name = ?"); values.push(String(body.first_name)); }
    if (body.last_name !== undefined) { fields.push("last_name = ?"); values.push(String(body.last_name)); }
    if (body.phone !== undefined) { fields.push("phone = ?"); values.push(body.phone ? String(body.phone) : null); }
    if (body.email !== undefined) { fields.push("email = ?"); values.push(String(body.email)); }

    if (fields.length === 0) {
      return c.json(err("No fields to update"), 400);
    }

    db.query(`UPDATE users SET ${fields.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...values, userId);
    const user = getUserById(db, userId);
    return c.json(ok(user, "Profile updated"));
  });
}
