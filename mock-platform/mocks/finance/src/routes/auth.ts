import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import { sign, tokenCookieOptions } from "mock-lib";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import { LoginRequestSchema, LoginResponseSchema } from "../schemas/auth";
import { ErrorResponseSchema } from "../schemas/common";
import { verifyWerkzeugHash } from "../helpers";

export function registerAuthRoutes(app: OpenAPIApp, db: Database) {
  const loginRoute = createRoute({
    method: "post",
    path: "/api/auth/login",
    summary: "Login",
    request: {
      body: {
        content: {
          "application/json": {
            schema: LoginRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Login successful",
        content: { "application/json": { schema: LoginResponseSchema } },
      },
      401: {
        description: "Invalid credentials",
        content: { "application/json": { schema: ErrorResponseSchema } },
      },
    },
  });

  app.openApiRoute(loginRoute, async (c) => {
    const body = await c.req.json();
    const { username, password } = body;

    const row = db
      .query<{ id: number; password_hash: string; role: string; is_active: number }, [string]>(
        "SELECT id, password_hash, role, is_active FROM user WHERE username = ?"
      )
      .get(username);

    if (!row || !(await verifyWerkzeugHash(row.password_hash, password)) || row.is_active !== 1) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const jwt = await sign({ userId: row.id, role: row.role });
    setCookie(c, "token", jwt, tokenCookieOptions());
    return c.json({ user: { id: row.id, username, role: row.role } });
  });

  const logoutRoute = createRoute({
    method: "post",
    path: "/api/auth/logout",
    summary: "Logout",
    responses: {
      302: { description: "Redirect to login" },
    },
  });

  app.openApiRoute(logoutRoute, (c) => {
    setCookie(c, "token", "", { ...tokenCookieOptions(), maxAge: 0 });
    return c.redirect("/login");
  });
}
