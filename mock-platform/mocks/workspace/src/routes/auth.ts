import type { OpenAPIApp } from "mock-lib";
import { createRoute, tokenCookieOptions, sign } from "mock-lib";
import { z } from "zod";
import { setCookie, deleteCookie } from "hono/cookie";
import type { Database } from "bun:sqlite";
import { getUserByUsername } from "../data/store.js";

export function registerAuthRoutes(app: OpenAPIApp, db: Database): void {
  const loginRoute = createRoute({
    method: "post",
    path: "/api/auth/login",
    summary: "Login",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              username: z.string(),
              password: z.string(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              redirect: z.string(),
            }),
          },
        },
        description: "Login successful",
      },
      401: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Invalid credentials",
      },
    },
  });

  app.openApiRoute(loginRoute, async (c) => {
    const { username, password } = c.req.valid("json");
    const user = getUserByUsername(db, username);

    if (!user || user.password !== password) {
      return c.json({ error: "Invalid username or password" }, 401);
    }

    const jwt = await sign({ userId: user.id });
    setCookie(c, "token", jwt, { ...tokenCookieOptions(), secure: false });

    return c.json({ success: true, redirect: "/workspace" }, 200);
  });

  const logoutRoute = createRoute({
    method: "post",
    path: "/api/auth/logout",
    summary: "Logout",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ redirect: z.string() }),
          },
        },
        description: "Logout successful",
      },
    },
  });

  app.openApiRoute(logoutRoute, (c) => {
    deleteCookie(c, "token", { path: "/" });
    return c.json({ redirect: "/" }, 200);
  });
}
