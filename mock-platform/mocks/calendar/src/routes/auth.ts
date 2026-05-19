import { z } from "zod";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute, sign } from "mock-lib";
import { getUserByEmail, getUserById, verifyWerkzeugHash, getAuthUserId } from "../helpers";

const LoginBody = z.object({ email: z.string(), password: z.string() });
const UserSchema = z.object({ id: z.number(), email: z.string(), display_name: z.string(), created_at: z.string() });
const LoginResponse = z.object({ ok: z.boolean(), message: z.string(), access_token: z.string(), user: UserSchema });
const ErrorResponse = z.object({ ok: z.boolean(), error: z.string() });

export function registerAuthRoutes(app: OpenAPIApp, db: Database): void {
  const loginRoute = createRoute({
    method: "post",
    path: "/api/auth/login",
    summary: "Login with email and password",
    request: { body: { content: { "application/json": { schema: LoginBody } }, description: "Credentials" } },
    responses: {
      200: { content: { "application/json": { schema: LoginResponse } }, description: "OK" },
      401: { content: { "application/json": { schema: ErrorResponse } }, description: "Unauthorized" },
    },
  });

  app.openApiRoute(loginRoute, async (c) => {
    const { email, password } = c.req.valid("json");
    const row = db
      .query("SELECT id, password_hash FROM users WHERE email = ?")
      .get(email) as { id: number; password_hash: string } | null;
    if (!row) return c.json({ ok: false, error: "Invalid email or password" }, 401);
    const valid = await verifyWerkzeugHash(row.password_hash, password);
    if (!valid) return c.json({ ok: false, error: "Invalid email or password" }, 401);
    const user = getUserByEmail(db, email)!;
    const access_token = await sign({ userId: row.id });
    return c.json({ ok: true, message: "Login successful", access_token, user });
  });

  const meRoute = createRoute({
    method: "get",
    path: "/api/auth/me",
    summary: "Get current user",
    responses: {
      200: { content: { "application/json": { schema: z.object({ ok: z.boolean(), user: UserSchema }) } }, description: "OK" },
      401: { content: { "application/json": { schema: ErrorResponse } }, description: "Unauthorized" },
    },
  });

  app.openApiRoute(meRoute, async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json({ ok: false, error: "Authentication required" }, 401);
    const user = getUserById(db, userId);
    if (!user) return c.json({ ok: false, error: "User not found" }, 404);
    return c.json({ ok: true, user });
  });
}
