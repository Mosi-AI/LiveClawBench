import { createRoute, sign, tokenCookieOptions } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import { z } from "zod";
import { getExpenseDb } from "../utils/db.js";
import { TokenRequestSchema, TokenResponseSchema } from "../schemas.js";

export function registerAuthRoutes(app: OpenAPIApp): void {
  const tokenRoute = createRoute({
    method: "post",
    path: "/api/auth/token",
    summary: "Exchange credentials for JWT",
    request: {
      body: { content: { "application/json": { schema: TokenRequestSchema } } },
    },
    responses: {
      200: { content: { "application/json": { schema: TokenResponseSchema } }, description: "JWT token" },
      401: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Invalid credentials" },
    },
  });

  app.openApiRoute(tokenRoute, async (c) => {
    const { email, password } = c.req.valid("json");
    const db = getExpenseDb();
    const user = db.query("SELECT * FROM user WHERE email = ? AND password = ? AND is_active = 1").get(email, password) as Record<string, unknown> | null;
    if (!user) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    db.exec("UPDATE user SET last_login_at = datetime('now') WHERE id = ?", [user.id]);

    const token = await sign({
      sub: email,
      userId: user.id as number,
      role: user.role as string,
    });

    return c.json({ token, expires_in: 3600 });
  });

  const logoutRoute = createRoute({
    method: "post",
    path: "/api/auth/logout",
    summary: "Clear session",
    security: [{ bearerAuth: [] }],
    responses: {
      200: { content: { "application/json": { schema: z.object({ success: z.boolean() }) } }, description: "Logged out" },
    },
  });

  app.openApiRoute(logoutRoute, async (c) => {
    const opts = tokenCookieOptions();
    c.header("Set-Cookie", `token=; Path=${opts.path}; Max-Age=0; HttpOnly; SameSite=${opts.sameSite}`);
    return c.json({ success: true });
  }, { auth: "required" });
}
