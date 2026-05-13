import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { isResponse, jsonError, runDbMutation } from "./helpers";
import { RedirectResponse } from "./schemas";
import type { MintDietApp, RouteDeps } from "./types";

export function resetMutableTables(d: Database): void {
  d.transaction(() => {
    d.run("DELETE FROM ingredient_item");
    d.run("DELETE FROM meal_plan_item");
    d.run("DELETE FROM meal_plan_day");
    d.run("DELETE FROM food_entry");
    d.run("DELETE FROM meal_plan");
    d.run("DELETE FROM daily_log");
    d.run(`
      DELETE FROM sqlite_sequence
      WHERE name IN (
        'daily_log',
        'food_entry',
        'meal_plan',
        'meal_plan_day',
        'meal_plan_item',
        'ingredient_item'
      )
    `);
  })();
}

export function registerAdminRoutes(app: MintDietApp, { getDatabase }: RouteDeps) {
  const resetRoute = createRoute({
    method: "post",
    path: "/admin/reset",
    summary: "Reset mutable diet data",
    responses: {
      303: RedirectResponse,
      404: {
        description: "Not found - admin not enabled",
        content: {
          "application/json": {
            schema: { type: "object", properties: { success: { type: "boolean" }, message: { type: "string" } } },
          },
        },
      },
      500: {
        description: "Server error",
        content: {
          "application/json": {
            schema: { type: "object", properties: { success: { type: "boolean" }, message: { type: "string" } } },
          },
        },
      },
    },
  });

  app.openApiRoute(resetRoute, async (c) => {
    if (!process.env.MOCK_ADMIN || process.env.MOCK_ADMIN !== "1") {
      return jsonError(c, "Not found", 404);
    }

    const d = getDatabase();
    const reset = runDbMutation(c, () => resetMutableTables(d));
    if (isResponse(reset)) return reset;
    const checkpoint = runDbMutation(c, () => d.run("PRAGMA wal_checkpoint(FULL)"));
    if (isResponse(checkpoint)) return checkpoint;

    return c.redirect("/", 303);
  });
}
