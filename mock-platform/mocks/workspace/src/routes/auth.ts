import type { OpenAPIApp } from "mock-lib";
import { createRoute, tokenCookieOptions, sign, err, ok } from "mock-lib";
import { z } from "zod";
import { setCookie, deleteCookie } from "hono/cookie";
import type { Database } from "bun:sqlite";
import bcryptjs from "bcryptjs";
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

    if (!user || !bcryptjs.compareSync(password, user.password)) {
      return c.json(err("Invalid username or password"), 401);
    }

    const jwt = await sign({ userId: user.id });
    setCookie(c, "token", jwt, { ...tokenCookieOptions(), secure: false });

    return c.json(ok({ redirect: "/workspace" }), 200);
  });

  // Logout is a public route — registered directly on hono to avoid
  // @hono/zod-openapi type mismatch with redirect responses.
  (app as any).post("/api/auth/logout", (c: any) => {
    deleteCookie(c, "token", { path: "/" });
    return c.redirect("/", 302);
  });
}
