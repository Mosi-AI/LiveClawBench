import { z } from "zod";
import bcryptjs from "bcryptjs";
import { sign, verify, BCRYPT_SALT_ROUNDS, tokenCookieOptions, serializeCookie, createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { ok, err, getUserById, DEFAULT_USER_ID } from "../helpers";

const OkResponse = z.object({ ok: z.boolean() }).passthrough();
const ErrResponse = z.object({ ok: z.boolean(), error: z.string() });

export function registerAuthRoutes(app: OpenAPIApp, db: Database): void {
  // POST /api/auth/register
  app.openApiRoute(
    createRoute({
      method: "post",
      path: "/api/auth/register",
      summary: "Register a new user",
      responses: {
        201: { content: { "application/json": { schema: OkResponse } }, description: "Created" },
        400: { content: { "application/json": { schema: ErrResponse } }, description: "Bad Request" },
      },
    }),
    async (c) => {
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
      const refreshToken = await sign({ userId, type: "refresh" }, 7 * 24 * 3600);
      const cookieStr = serializeCookie("token", token, tokenCookieOptions());
      c.header("Set-Cookie", cookieStr);
      return c.json(ok({ user, access_token: token, refresh_token: refreshToken }, "Registration successful"), 201);
    },
  );

  // POST /api/auth/login
  app.openApiRoute(
    createRoute({
      method: "post",
      path: "/api/auth/login",
      summary: "Login with email and password",
      responses: {
        200: { content: { "application/json": { schema: OkResponse } }, description: "OK" },
        401: { content: { "application/json": { schema: ErrResponse } }, description: "Unauthorized" },
      },
    }),
    async (c) => {
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
      const refreshToken = await sign({ userId: row.id, type: "refresh" }, 7 * 24 * 3600);
      const cookieStr = serializeCookie("token", token, tokenCookieOptions());
      c.header("Set-Cookie", cookieStr);
      return c.json(ok({ user, access_token: token, refresh_token: refreshToken }, "Login successful"));
    },
  );

  // POST /api/auth/refresh
  app.openApiRoute(
    createRoute({
      method: "post",
      path: "/api/auth/refresh",
      summary: "Refresh access token using refresh token",
      responses: {
        200: { content: { "application/json": { schema: OkResponse } }, description: "OK" },
        401: { content: { "application/json": { schema: ErrResponse } }, description: "Unauthorized" },
      },
    }),
    async (c) => {
      let body: Record<string, unknown> = {};
      try { body = await c.req.json(); } catch { /* body is optional */ }
      const refreshTokenStr = body.refresh_token ? String(body.refresh_token) : null;
      if (!refreshTokenStr) {
        return c.json(err("Valid refresh_token required"), 401);
      }
      const payload = await verify(refreshTokenStr);
      if (!payload || payload.type !== "refresh" || !payload.userId) {
        return c.json(err("Invalid or expired refresh token"), 401);
      }
      const token = await sign({ userId: payload.userId as number });
      return c.json(ok({ access_token: token }, "Token refreshed"));
    },
  );

  // GET /api/auth/profile
  app.openApiRoute(
    createRoute({
      method: "get",
      path: "/api/auth/profile",
      summary: "Get current user profile",
      responses: {
        200: { content: { "application/json": { schema: OkResponse } }, description: "OK" },
        404: { content: { "application/json": { schema: ErrResponse } }, description: "Not Found" },
      },
    }),
    (c) => {
      const userId = (c.get("userId") ?? DEFAULT_USER_ID);
      const user = getUserById(db, userId);
      if (!user) return c.json(err("User not found"), 404);
      return c.json(ok(user));
    },
  );

  // PUT /api/auth/profile
  app.openApiRoute(
    createRoute({
      method: "put",
      path: "/api/auth/profile",
      summary: "Update current user profile",
      responses: {
        200: { content: { "application/json": { schema: OkResponse } }, description: "OK" },
        400: { content: { "application/json": { schema: ErrResponse } }, description: "Bad Request" },
      },
    }),
    async (c) => {
      const userId = (c.get("userId") ?? DEFAULT_USER_ID);
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
    },
  );

  // POST /api/auth/change-password
  app.openApiRoute(
    createRoute({
      method: "post",
      path: "/api/auth/change-password",
      summary: "Change password for current user",
      responses: {
        200: { content: { "application/json": { schema: OkResponse } }, description: "OK" },
        400: { content: { "application/json": { schema: ErrResponse } }, description: "Bad Request" },
        401: { content: { "application/json": { schema: ErrResponse } }, description: "Unauthorized" },
      },
    }),
    async (c) => {
      const userId = (c.get("userId") ?? DEFAULT_USER_ID);
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
    },
  );
}
