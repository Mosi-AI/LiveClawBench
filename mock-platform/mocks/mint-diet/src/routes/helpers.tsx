import type { AppEnv } from "mock-lib";
import type { Context } from "hono";
import { LOG_SLOTS, PLAN_SLOTS, PLAN_STATUSES } from "../constants";
import type { MealSlot, PlanMealSlot, PlanStatus } from "../queries";
import { err } from "mock-lib";

type ParsedBody = Awaited<ReturnType<Context<AppEnv>["req"]["parseBody"]>>;

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

export async function parseBodyOrBadRequest(c: Context<AppEnv>): Promise<ParsedBody | Response> {
  try {
    return await c.req.parseBody();
  } catch (e) {
    console.error("Failed to parse request body", e);
    return c.json(err("Malformed request body"), 400);
  }
}

/**
 * Run a database mutation with error handling.
 * Returns JSON error response on failure for API consistency.
 */
export function runDbMutation<T>(c: Context<AppEnv>, action: () => T): T | Response {
  try {
    return action();
  } catch (e) {
    console.error("Database mutation failed", e);
    return c.json(err("Could not save changes. Please try again."), 500);
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
