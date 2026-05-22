import type { Context, Next } from "hono";
import { verify } from "mock-lib";
import type { AppEnv } from "mock-lib";

export function readToken(c: Context<AppEnv>): string | null {
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  const cookieHeader = c.req.header("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)token=([^;]*)/);
    if (match) return match[1];
  }
  return null;
}

export async function authRequiredPage(c: Context<AppEnv>, next: Next) {
  const token = readToken(c);
  if (!token) return c.redirect("/");
  const payload = await verify(token);
  if (!payload) return c.redirect("/");
  c.set("userId", payload.userId as number | undefined);
  await next();
}
