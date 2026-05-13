import bcryptjs from "bcryptjs";
import { sign, BCRYPT_SALT_ROUNDS, tokenCookieOptions, serializeCookie } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { ok, err, getUserById } from "../helpers";

export function registerAuthRoutes(app: OpenAPIApp, db: Database): void {
  // POST /api/auth/register
  app.post("/api/auth/register", async (c) => {
    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json(err("Invalid JSON body"), 400);
    }
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

    const passwordHash = bcryptjs.hashSync(password, BCRYPT_SALT_ROUNDS);
    const insertResult = db.query(
      "INSERT INTO users (email, password_hash, first_name, last_name, phone, date_of_birth, is_verified, is_active) VALUES (?, ?, ?, ?, ?, ?, 1, 1)"
    ).run(email, passwordHash, firstName, lastName, phone, dateOfBirth);

    const userId = Number(insertResult.lastInsertRowid);
    const user = getUserById(db, userId);
    const token = await sign({ userId });
    const cookieStr = serializeCookie("token", token, tokenCookieOptions());
    c.header("Set-Cookie", cookieStr);
    return c.json(ok({ user, access_token: token, refresh_token: token + "-refresh" }, "Registration successful"), 201);
  });

  // POST /api/auth/login
  app.post("/api/auth/login", async (c) => {
    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json(err("Invalid JSON body"), 400);
    }
    const email = String(body.email ?? "");
    const password = String(body.password ?? "");

    const row = db.query("SELECT id, password_hash FROM users WHERE email = ?").get(email) as { id: number; password_hash: string } | null;
    if (!row || !bcryptjs.compareSync(password, row.password_hash)) {
      return c.json(err("Invalid email or password"), 401);
    }

    const user = getUserById(db, row.id);
    const token = await sign({ userId: row.id });
    const cookieStr = serializeCookie("token", token, tokenCookieOptions());
    c.header("Set-Cookie", cookieStr);
    return c.json(ok({ user, access_token: token, refresh_token: token + "-refresh" }, "Login successful"));
  });

  // POST /api/auth/refresh
  app.post("/api/auth/refresh", async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json(err("Authentication required"), 401);
    const token = await sign({ userId });
    return c.json(ok({ access_token: token }, "Token refreshed"));
  });

  // GET /api/auth/profile
  app.get("/api/auth/profile", (c) => {
    const userId = c.get("userId")!;
    const user = getUserById(db, userId);
    if (!user) return c.json(err("User not found"), 404);
    return c.json(ok(user));
  });

  // PUT /api/auth/profile
  app.put("/api/auth/profile", async (c) => {
    const userId = c.get("userId")!;
    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json(err("Invalid JSON body"), 400);
    }
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

    db.query(`UPDATE users SET ${fields.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...values, userId);
    const user = getUserById(db, userId);
    return c.json(ok(user, "Profile updated"));
  });

  // POST /api/auth/change-password
  app.post("/api/auth/change-password", async (c) => {
    const userId = c.get("userId")!;
    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json(err("Invalid JSON body"), 400);
    }
    const oldPassword = String(body.old_password ?? "");
    const newPassword = String(body.new_password ?? "");

    const row = db.query("SELECT id, password_hash FROM users WHERE id = ?").get(userId) as { id: number; password_hash: string } | null;
    if (!row || !bcryptjs.compareSync(oldPassword, row.password_hash)) {
      return c.json(err("Current password is incorrect"), 401);
    }

    const newHash = bcryptjs.hashSync(newPassword, BCRYPT_SALT_ROUNDS);
    db.query("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(newHash, userId);
    return c.json(ok(null, "Password changed successfully"));
  });
}
