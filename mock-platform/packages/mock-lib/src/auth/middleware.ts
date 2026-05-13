/**
 * Auth middleware for per-route JWT protection.
 *
 * Usage in mock routes:
 *   import { authRequired, authOptional } from "mock-lib/auth/middleware";
 *   app.use("/api/*", authRequired);
 *   app.get("/api/public", authOptional, handler);
 */

import type { Context, Next } from "hono";
import type { AppEnv } from "../types";
import { verify } from "./jwt";
import { err } from "../response";

/**
 * Extract JWT from Authorization header or cookie.
 */
function extractToken(c: Context<AppEnv>): string | null {
  // Try Authorization header first
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Try cookie
  const cookieToken = c.req.header("cookie");
  if (cookieToken) {
    const match = cookieToken.match(/(?:^|;\s*)token=([^;]*)/);
    if (match) return match[1];
  }

  return null;
}

/**
 * Middleware that requires a valid JWT.
 * Sets c.var.userId if authenticated, returns 401 if not.
 */
export async function authRequired(c: Context<AppEnv>, next: Next) {
  const token = extractToken(c);
  if (!token) {
    return c.json(err("Authentication required"), 401);
  }

  const payload = await verify(token);
  if (!payload) {
    return c.json(err("Invalid or expired token"), 401);
  }

  c.set("userId", payload.userId as number | undefined);
  await next();
}

/**
 * Middleware that extracts JWT if present but does not require it.
 * Sets c.var.userId if a valid token is found, otherwise continues.
 */
export async function authOptional(c: Context<AppEnv>, next: Next) {
  const token = extractToken(c);
  if (token) {
    const payload = await verify(token);
    if (payload) {
      c.set("userId", payload.userId as number | undefined);
    }
  }
  await next();
}
