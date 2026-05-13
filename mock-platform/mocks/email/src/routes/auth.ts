import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { sign, verify } from "mock-lib";
import { ok, err, getUserById, verifyWerkzeugHash, generateWerkzeugHashSync } from "../helpers";
import {
  AuthRegisterBodySchema,
  AuthLoginBodySchema,
  AuthRegisterResponseSchema,
  AuthLoginResponseSchema,
  AuthMeResponseSchema,
  ErrorResponseSchema,
} from "../schemas";

export function registerAuthRoutes(app: OpenAPIApp, db: Database): void {
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
        content: { "application/json": { schema: AuthRegisterResponseSchema } },
        description: "Created",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Bad request",
      },
    },
  });

  app.openApiRoute(registerRoute, async (c) => {
    const { username, email, password } = c.req.valid("json");

    const existingUsername = db.query("SELECT id FROM users WHERE username = ?").get(username) as { id: number } | null;
    if (existingUsername) {
      return c.json(err("Username already exists"), 400);
    }
    const existingEmail = db.query("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | null;
    if (existingEmail) {
      return c.json(err("Email already registered"), 400);
    }

    const passwordHash = generateWerkzeugHashSync(password);
    const { lastInsertRowid: userId } = db.query(
      "INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, datetime('now'))"
    ).run(username, email, passwordHash);

    const user = getUserById(db, Number(userId));
    const accessToken = await sign({ userId: Number(userId) });

    return c.json(ok({ message: "User registered successfully", user, access_token: accessToken }, "User registered successfully"), 201);
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
        content: { "application/json": { schema: AuthLoginResponseSchema } },
        description: "OK",
      },
      401: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unauthorized",
      },
    },
  });

  app.openApiRoute(loginRoute, async (c) => {
    const { username, password } = c.req.valid("json");

    const row = db.query("SELECT id, password_hash FROM users WHERE username = ?").get(username) as
      | { id: number; password_hash: string }
      | null;
    if (!row) {
      return c.json(err("Invalid username or password"), 401);
    }

    const valid = await verifyWerkzeugHash(row.password_hash, password);

    if (!valid) {
      return c.json(err("Invalid username or password"), 401);
    }

    const user = getUserById(db, row.id);
    const accessToken = await sign({ userId: row.id });

    return c.json(ok({ message: "Login successful", user, access_token: accessToken }, "Login successful"));
  });

  // GET /api/auth/me
  const meRoute = createRoute({
    method: "get",
    path: "/api/auth/me",
    summary: "Get current user",
    responses: {
      200: {
        content: { "application/json": { schema: AuthMeResponseSchema } },
        description: "OK",
      },
      401: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unauthorized",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(meRoute, async (c) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json(err("Authentication required"), 401);
    }

    const token = authHeader.slice(7);
    const payload = await verify(token);
    if (!payload?.userId) {
      return c.json(err("Invalid or expired token"), 401);
    }

    const user = getUserById(db, payload.userId as number);
    if (!user) {
      return c.json(err("User not found"), 404);
    }

    return c.json(ok({ user }));
  });
}
