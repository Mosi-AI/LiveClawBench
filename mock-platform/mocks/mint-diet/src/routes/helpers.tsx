import type { AppEnv } from "mock-lib";
import type { Context } from "hono";
import { LOG_SLOTS, PLAN_SLOTS, PLAN_STATUSES } from "../constants";
import { Layout } from "../components";
import type { MealSlot, PlanMealSlot, PlanStatus } from "../queries";

type ParsedBody = Awaited<ReturnType<Context<AppEnv>["req"]["parseBody"]>>;

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

export function renderMessage(c: Context<AppEnv>, title: string, message: string, status: 400 | 500) {
  return c.html(<Layout title={title}><p>{message}</p></Layout>, status) as Response;
}

export async function parseBodyOrBadRequest(c: Context<AppEnv>): Promise<ParsedBody | Response> {
  try {
    return await c.req.parseBody();
  } catch (err) {
    console.error("Failed to parse request body", err);
    return renderMessage(c, "Bad Request", "Malformed request body", 400);
  }
}

export function runDbMutation<T>(c: Context<AppEnv>, action: () => T): T | Response {
  try {
    return action();
  } catch (err) {
    console.error("Database mutation failed", err);
    return renderMessage(c, "Server Error", "Could not save changes. Please try again.", 500);
  }
}

export function isMealSlot(value: string): value is MealSlot {
  return (LOG_SLOTS as readonly string[]).includes(value);
}

export function isPlanMealSlot(value: string): value is PlanMealSlot {
  return (PLAN_SLOTS as readonly string[]).includes(value);
}

export function isPlanStatus(value: string): value is PlanStatus {
  return (PLAN_STATUSES as readonly string[]).includes(value);
}

export function parsePositiveInt(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseInt(s, 10);
  if (!isNaN(n) && n > 0 && String(n) === s) return n;
  return null;
}

export function parseNonNegFloat(s: string | undefined): number | null {
  if (s === undefined || s === "") return null;
  const n = Number(s);
  if (!isNaN(n) && isFinite(n) && n >= 0) return n;
  return null;
}
