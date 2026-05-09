import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { ok, err, getUserById, DEFAULT_USER_ID } from "../helpers";

/**
 * NOTE: This mock intentionally uses plaintext passwords and fake JWTs
 * to match the behavior of the original Python Flask implementation.
 * Do NOT use this pattern for new mocks. See mock-conventions.md.
 */
function generateJwtToken(userId: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString("base64url");
  return `${header}.${payload}.mock-signature`;
}

export function registerAuthRoutes(app: OpenAPIApp, db: Database): void {
  // POST /api/auth/register
  app.post("/api/auth/register", async (c) => {
    const body = (await c.req.json()) as Record<string, unknown>;
    const email = String(body.email ?? "");
    const password = String(body.password ?? "");
    const firstName = String(body.first_name ?? "");
    const lastName = String(body.last_name ?? "");
    const phone = body.phone ? String(body.phone) : null;
    const dateOfBirth = body.date_of_birth ? String(body.date_of_birth) : null;

    if (!email || !password || !firstName || !lastName) {
      return c.json(err("Email, password, first_name and last_name are required"), 400);
    }

    const existing = db.query("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | null;
    if (existing) {
      return c.json(err("Email already registered"), 400);
    }

    const result = db.query(
      "INSERT INTO users (email, password_hash, first_name, last_name, phone, date_of_birth, is_verified, is_active) VALUES (?, ?, ?, ?, ?, ?, 1, 1)"
    ).run(email, password, firstName, lastName, phone, dateOfBirth);

    const userId = Number(result.lastInsertRowid);
    const user = getUserById(db, userId);
    return c.json(ok({ user, access_token: generateJwtToken(userId), refresh_token: generateJwtToken(userId) + "-refresh" }, "Registration successful"), 201);
  });

  // POST /api/auth/login
  app.post("/api/auth/login", async (c) => {
    const body = (await c.req.json()) as Record<string, unknown>;
    const email = String(body.email ?? "");
    const password = String(body.password ?? "");

    const row = db.query("SELECT * FROM users WHERE email = ? AND password_hash = ?").get(email, password) as { id: number } | null;
    if (!row) {
      return c.json(err("Invalid email or password"), 401);
    }

    const user = getUserById(db, row.id);
    return c.json(ok({ user, access_token: generateJwtToken(row.id), refresh_token: generateJwtToken(row.id) + "-refresh" }, "Login successful"));
  });

  // POST /api/auth/refresh
  app.post("/api/auth/refresh", async (c) => {
    return c.json(ok({ access_token: "mock_token" }, "Token refreshed"));
  });

  // GET /api/auth/profile
  app.get("/api/auth/profile", (c) => {
    const user = getUserById(db, DEFAULT_USER_ID);
    if (!user) return c.json(err("User not found"), 404);
    return c.json(ok(user));
  });

  // PUT /api/auth/profile
  app.put("/api/auth/profile", async (c) => {
    const body = (await c.req.json()) as Record<string, unknown>;
    const fields: string[] = [];
    const values: (string | null)[] = [];

    if (body.first_name !== undefined) { fields.push("first_name = ?"); values.push(String(body.first_name)); }
    if (body.last_name !== undefined) { fields.push("last_name = ?"); values.push(String(body.last_name)); }
    if (body.phone !== undefined) { fields.push("phone = ?"); values.push(body.phone ? String(body.phone) : null); }
    if (body.email !== undefined) { fields.push("email = ?"); values.push(String(body.email)); }
    if (body.date_of_birth !== undefined) { fields.push("date_of_birth = ?"); values.push(body.date_of_birth ? String(body.date_of_birth) : null); }

    if (fields.length === 0) {
      return c.json(err("No fields to update"), 400);
    }

    db.query(`UPDATE users SET ${fields.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...values, DEFAULT_USER_ID);
    const user = getUserById(db, DEFAULT_USER_ID);
    return c.json(ok(user, "Profile updated"));
  });

  // POST /api/auth/change-password
  app.post("/api/auth/change-password", async (c) => {
    const body = (await c.req.json()) as Record<string, unknown>;
    const oldPassword = String(body.old_password ?? "");
    const newPassword = String(body.new_password ?? "");

    const row = db.query("SELECT id FROM users WHERE id = ? AND password_hash = ?").get(DEFAULT_USER_ID, oldPassword) as { id: number } | null;
    if (!row) {
      return c.json(err("Current password is incorrect"), 401);
    }

    db.query("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(newPassword, DEFAULT_USER_ID);
    return c.json(ok(null, "Password changed successfully"));
  });
}
