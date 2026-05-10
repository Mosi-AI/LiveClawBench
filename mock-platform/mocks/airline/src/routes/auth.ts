import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { z } from "zod";
import { createRoute } from "mock-lib";
import { sign } from "mock-lib";
import { ok, err } from "mock-lib";
import { getUserById, DEFAULT_USER_ID, verifyWerkzeugHash, generateWerkzeugHashSync } from "../helpers";
import {
  OkSchema,
  ErrSchema,
  UserSchema,
  AuthRegisterBodySchema,
  AuthLoginBodySchema,
  AuthChangePasswordBodySchema,
  AuthProfileUpdateBodySchema,
  AuthTokenResponseSchema,
} from "../schemas";

export function registerAuthRoutes(app: OpenAPIApp, db: Database): void {
  const tokenResponse = OkSchema(AuthTokenResponseSchema);
  const userResponse = OkSchema(UserSchema);
  const messageResponse = OkSchema(z.null());

  // POST /api/auth/register
  const registerRoute = createRoute({
    method: "post",
    path: "/api/auth/register",
    summary: "Register a new user",
    request: {
      body: {
        content: { "application/json": { schema: AuthRegisterBodySchema } },
        description: "Registration data",
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: tokenResponse } },
        description: "Created",
      },
      400: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Bad request",
      },
    },
  });

  app.openApiRoute(registerRoute, async (c) => {
    const { email, password, first_name, last_name, phone, date_of_birth } = c.req.valid("json");

    const existing = db.query("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | null;
    if (existing) {
      return c.json(err("Email already registered"), 400);
    }

    const passwordHash = generateWerkzeugHashSync(password);
    const result = db.query(
      "INSERT INTO users (email, password_hash, first_name, last_name, phone, date_of_birth, is_verified, is_active) VALUES (?, ?, ?, ?, ?, ?, 1, 1)"
    ).run(email, passwordHash, first_name, last_name, phone ?? null, date_of_birth ?? null);

    const userId = Number(result.lastInsertRowid);
    const user = getUserById(db, userId);
    const accessToken = await sign({ userId });
    return c.json(ok({ user, access_token: accessToken, refresh_token: accessToken + "-refresh" }, "Registration successful"), 201);
  });

  // POST /api/auth/login
  const loginRoute = createRoute({
    method: "post",
    path: "/api/auth/login",
    summary: "User login",
    request: {
      body: {
        content: { "application/json": { schema: AuthLoginBodySchema } },
        description: "Login credentials",
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: tokenResponse } },
        description: "OK",
      },
      401: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Unauthorized",
      },
    },
  });

  app.openApiRoute(loginRoute, async (c) => {
    const { email, password } = c.req.valid("json");

    const row = db.query("SELECT id, password_hash FROM users WHERE email = ?").get(email) as
      | { id: number; password_hash: string }
      | null;
    if (!row) {
      return c.json(err("Invalid email or password"), 401);
    }

    const valid = await verifyWerkzeugHash(row.password_hash, password);

    if (!valid) {
      return c.json(err("Invalid email or password"), 401);
    }

    const user = getUserById(db, row.id);
    const accessToken = await sign({ userId: row.id });
    return c.json(ok({ user, access_token: accessToken, refresh_token: accessToken + "-refresh" }, "Login successful"));
  });

  // POST /api/auth/refresh
  const refreshRoute = createRoute({
    method: "post",
    path: "/api/auth/refresh",
    summary: "Refresh access token",
    responses: {
      200: {
        content: { "application/json": { schema: OkSchema(z.object({ access_token: z.string() })) } },
        description: "OK",
      },
    },
  });

  app.openApiRoute(refreshRoute, async (c) => {
    const accessToken = await sign({ userId: DEFAULT_USER_ID });
    return c.json(ok({ access_token: accessToken }, "Token refreshed"));
  });

  // GET /api/auth/profile
  const profileRoute = createRoute({
    method: "get",
    path: "/api/auth/profile",
    summary: "Get current user profile",
    responses: {
      200: {
        content: { "application/json": { schema: userResponse } },
        description: "OK",
      },
      404: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(profileRoute, (c) => {
    const user = getUserById(db, DEFAULT_USER_ID);
    if (!user) return c.json(err("User not found"), 404);
    return c.json(ok(user));
  });

  // PUT /api/auth/profile
  const updateProfileRoute = createRoute({
    method: "put",
    path: "/api/auth/profile",
    summary: "Update current user profile",
    request: {
      body: {
        content: { "application/json": { schema: AuthProfileUpdateBodySchema } },
        description: "Profile updates",
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: userResponse } },
        description: "OK",
      },
      400: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Bad request",
      },
    },
  });

  app.openApiRoute(updateProfileRoute, async (c) => {
    const data = c.req.valid("json");
    const fields: string[] = [];
    const values: (string | null)[] = [];

    if (data.first_name !== undefined) { fields.push("first_name = ?"); values.push(String(data.first_name)); }
    if (data.last_name !== undefined) { fields.push("last_name = ?"); values.push(String(data.last_name)); }
    if (data.phone !== undefined) { fields.push("phone = ?"); values.push(data.phone ? String(data.phone) : null); }
    if (data.email !== undefined) { fields.push("email = ?"); values.push(String(data.email)); }
    if (data.date_of_birth !== undefined) { fields.push("date_of_birth = ?"); values.push(data.date_of_birth ? String(data.date_of_birth) : null); }

    if (fields.length === 0) {
      return c.json(err("No fields to update"), 400);
    }

    db.query(`UPDATE users SET ${fields.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...values, DEFAULT_USER_ID);
    const user = getUserById(db, DEFAULT_USER_ID);
    return c.json(ok(user, "Profile updated"));
  });

  // POST /api/auth/change-password
  const changePasswordRoute = createRoute({
    method: "post",
    path: "/api/auth/change-password",
    summary: "Change password",
    request: {
      body: {
        content: { "application/json": { schema: AuthChangePasswordBodySchema } },
        description: "Password change",
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: messageResponse } },
        description: "OK",
      },
      401: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Unauthorized",
      },
      404: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(changePasswordRoute, async (c) => {
    const { old_password, new_password } = c.req.valid("json");

    const row = db.query("SELECT id, password_hash FROM users WHERE id = ?").get(DEFAULT_USER_ID) as
      | { id: number; password_hash: string }
      | null;
    if (!row) {
      return c.json(err("User not found"), 404);
    }

    const valid = await verifyWerkzeugHash(row.password_hash, old_password);

    if (!valid) {
      return c.json(err("Current password is incorrect"), 401);
    }

    const newHash = generateWerkzeugHashSync(new_password);
    db.query("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(newHash, DEFAULT_USER_ID);
    return c.json(ok(null, "Password changed successfully"));
  });
}
