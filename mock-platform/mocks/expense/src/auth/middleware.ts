import type { Context, Next } from "hono";
import type { AppEnv } from "mock-lib";
import { authOptional } from "mock-lib";

export async function pageAuthRequired(c: Context<AppEnv>, next: Next) {
  await authOptional(c, async () => {});
  if (!c.var.userId) {
    return c.redirect("/login", 302);
  }
  await next();
}
