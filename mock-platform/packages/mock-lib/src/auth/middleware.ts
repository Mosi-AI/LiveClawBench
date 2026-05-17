/**
 * Auth middleware for per-route JWT protection.
 *
 * Two usage forms:
 *
 *   // Direct (default JSON 401 on failure)
 *   app.use("/api/*", authRequired);
 *
 *   // Factory (configurable response)
 *   app.use("/dashboard/*", authRequired({ onUnauthorized: "redirect" }));
 *   app.use("/admin/*", authRequired({ onUnauthorized: "redirect", loginPath: "/admin/login" }));
 */

import type { Context, MiddlewareHandler, Next } from "hono";
import type { AppEnv } from "../types";
import { err } from "../response";
import { verify } from "./jwt";

export interface AuthOptions {
  /**
   * How to respond when authentication fails.
   * - "json"     → 401 JSON `{ error }` (default; suits API routes)
   * - "redirect" → 302 to loginPath with `?next=<original-path>` (suits SSR pages)
   */
  onUnauthorized?: "json" | "redirect";
  /**
   * Path to redirect to when onUnauthorized="redirect".
   * Defaults to "/login".
   */
  loginPath?: string;
}

/**
 * Extract JWT from cookie (preferred) or Authorization header (fallback).
 *
 * Cookie-first ordering matches the canonical login flow: the server sets
 * `Set-Cookie: token=...` and the browser replays it on every request.
 * Authorization Bearer is the fallback for non-browser API clients.
 */
function extractToken(c: Context<AppEnv>): string | null {
  const cookieHeader = c.req.header("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)token=([^;]*)/);
    if (match) return match[1];
  }
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

function unauthorized(
  c: Context<AppEnv>,
  opts: AuthOptions,
  reason: "missing" | "invalid",
): Response {
  if (opts.onUnauthorized === "redirect") {
    const path = opts.loginPath ?? "/login";
    return c.redirect(`${path}?next=${encodeURIComponent(c.req.path)}`);
  }
  const message =
    reason === "missing" ? "Authentication required" : "Invalid or expired token";
  return c.json(err(message), 401);
}

async function runAuthRequired(
  c: Context<AppEnv>,
  next: Next,
  opts: AuthOptions,
): Promise<Response | undefined> {
  const token = extractToken(c);
  if (!token) return unauthorized(c, opts, "missing");

  const payload = await verify(token);
  if (!payload) return unauthorized(c, opts, "invalid");

  c.set("userId", payload.userId as number | undefined);
  await next();
  return undefined;
}

/**
 * Direct middleware form. Hono calls this with `(c, next)`.
 */
export function authRequired(
  c: Context<AppEnv>,
  next: Next,
): Promise<Response | undefined>;
/**
 * Factory form. Returns a configured middleware.
 */
export function authRequired(opts?: AuthOptions): MiddlewareHandler<AppEnv>;
export function authRequired(
  arg1?: Context<AppEnv> | AuthOptions,
  arg2?: Next,
): Promise<Response | undefined> | MiddlewareHandler<AppEnv> {
  // When invoked as middleware, Hono passes `(c, next)` and `arg2` is a function.
  if (typeof arg2 === "function") {
    return runAuthRequired(arg1 as Context<AppEnv>, arg2, {});
  }
  // Factory form: capture opts in a closure.
  const opts = (arg1 as AuthOptions | undefined) ?? {};
  return async (c, next) => runAuthRequired(c, next, opts);
}

/**
 * Optional auth: extract userId if a valid token is present, but do not block.
 */
export async function authOptional(c: Context<AppEnv>, next: Next): Promise<void> {
  const token = extractToken(c);
  if (token) {
    const payload = await verify(token);
    if (payload) {
      c.set("userId", payload.userId as number | undefined);
    }
  }
  await next();
}
