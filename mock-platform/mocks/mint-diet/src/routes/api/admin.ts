import { z } from "zod";
import { createRoute, ok, err } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { OkSchema, ErrSchema } from "./schemas";

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

  d.run("PRAGMA wal_checkpoint(FULL)");
}

export function registerAdminRoutes(
  app: OpenAPIApp,
  getDatabase: () => Database
) {
  // POST /api/admin/reset
  const resetRoute = createRoute({
    method: "post",
    path: "/api/admin/reset",
    summary: "Reset all mutable data",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OkSchema(z.object({ message: z.string() })),
          },
        },
        description: "OK",
      },
      401: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Unauthorized",
      },
    },
  });

  app.openApiRoute(resetRoute, (c) => {
    if (!process.env.MOCK_ADMIN || process.env.MOCK_ADMIN !== "1") {
      return c.json(err("Not authorized"), 401);
    }

    const d = getDatabase();
    resetMutableTables(d);

    return c.json(ok({ message: "Data reset successfully" }));
  });
}
