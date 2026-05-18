import { z } from "zod";
import { createRoute, ok, err } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import {
  PlanIdParamSchema,
  ItemIdParamSchema,
  MealPlanItemSchema,
  CreatePlanItemBodySchema,
  UpdatePlanItemBodySchema,
  OkSchema,
  ErrSchema,
} from "./schemas";

export function registerPlanItemRoutes(
  app: OpenAPIApp,
  getDatabase: () => Database
) {
  // GET /api/meal-plans/:planId/items
  const listItemsRoute = createRoute({
    method: "get",
    path: "/api/meal-plans/{planId}/items",
    summary: "List plan items by day",
    request: {
      params: PlanIdParamSchema,
      query: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OkSchema(z.array(MealPlanItemSchema)),
          },
        },
        description: "OK",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Not Found",
      },
    },
  });

  app.openApiRoute(listItemsRoute, (c) => {
    const { planId } = c.req.valid("param");
    const { date } = c.req.valid("query");
    const d = getDatabase();

    const plan = d
      .query("SELECT id FROM meal_plan WHERE id = ?")
      .get(planId) as { id: number } | null;

    if (!plan) {
      return c.json(err("Plan not found"), 404);
    }

    let query = `
      SELECT i.id, i.meal_plan_day_id, i.meal_slot, i.dish_name, i.notes
      FROM meal_plan_item i
      JOIN meal_plan_day d ON i.meal_plan_day_id = d.id
      WHERE d.meal_plan_id = ?
    `;
    const params: (number | string)[] = [planId];

    if (date) {
      query += " AND d.plan_date = ?";
      params.push(date);
    }

    query += " ORDER BY d.plan_date, i.meal_slot";

    const items = d.query(query).all(...params) as Array<{
      id: number;
      meal_plan_day_id: number;
      meal_slot: string;
      dish_name: string;
      notes: string | null;
    }>;

    return c.json(ok(items));
  });

  // POST /api/meal-plans/:planId/items
  const createItemRoute = createRoute({
    method: "post",
    path: "/api/meal-plans/{planId}/items",
    summary: "Create plan item",
    request: {
      params: PlanIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: CreatePlanItemBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: OkSchema(MealPlanItemSchema),
          },
        },
        description: "Created",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Bad Request",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Not Found",
      },
    },
  });

  app.openApiRoute(createItemRoute, (c) => {
    const { planId } = c.req.valid("param");
    const body = c.req.valid("json");
    const d = getDatabase();

    const plan = d
      .query("SELECT id FROM meal_plan WHERE id = ?")
      .get(planId) as { id: number } | null;

    if (!plan) {
      return c.json(err("Plan not found"), 404);
    }

    const day = d
      .query(
        "SELECT id FROM meal_plan_day WHERE meal_plan_id = ? AND plan_date = ?"
      )
      .get(planId, body.plan_date) as { id: number } | null;

    if (!day) {
      return c.json(err("Day not found in plan"), 404);
    }

    const result = d.run(
      `INSERT INTO meal_plan_item (meal_plan_day_id, meal_slot, dish_name, notes)
       VALUES (?, ?, ?, ?)`,
      day.id,
      body.meal_slot,
      body.dish_name,
      body.notes
    );

    const item = d
      .query(
        `SELECT id, meal_plan_day_id, meal_slot, dish_name, notes
         FROM meal_plan_item WHERE id = ?`
      )
      .get(Number(result.lastInsertRowid)) as {
      id: number;
      meal_plan_day_id: number;
      meal_slot: string;
      dish_name: string;
      notes: string | null;
    };

    return c.json(ok(item), 201);
  });

  // PUT /api/meal-plans/:planId/items/:itemId
  const updateItemRoute = createRoute({
    method: "put",
    path: "/api/meal-plans/{planId}/items/{itemId}",
    summary: "Update plan item",
    request: {
      params: z.object({
        planId: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().positive()),
        itemId: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().positive()),
      }),
      body: {
        content: {
          "application/json": {
            schema: UpdatePlanItemBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OkSchema(MealPlanItemSchema),
          },
        },
        description: "OK",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Bad Request",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Not Found",
      },
    },
  });

  app.openApiRoute(updateItemRoute, (c) => {
    const { planId, itemId } = c.req.valid("param");
    const body = c.req.valid("json");
    const d = getDatabase();

    const item = d
      .query(
        `SELECT i.id FROM meal_plan_item i
         JOIN meal_plan_day d ON i.meal_plan_day_id = d.id
         WHERE i.id = ? AND d.meal_plan_id = ?`
      )
      .get(itemId, planId) as { id: number } | null;

    if (!item) {
      return c.json(err("Item not found"), 404);
    }

    d.run(
      `UPDATE meal_plan_item SET
       meal_slot = ?, dish_name = ?, notes = ?
       WHERE id = ?`,
      body.meal_slot,
      body.dish_name,
      body.notes,
      itemId
    );

    const updated = d
      .query(
        `SELECT id, meal_plan_day_id, meal_slot, dish_name, notes
         FROM meal_plan_item WHERE id = ?`
      )
      .get(itemId) as {
      id: number;
      meal_plan_day_id: number;
      meal_slot: string;
      dish_name: string;
      notes: string | null;
    };

    return c.json(ok(updated));
  });

  // DELETE /api/meal-plans/:planId/items/:itemId
  const deleteItemRoute = createRoute({
    method: "delete",
    path: "/api/meal-plans/{planId}/items/{itemId}",
    summary: "Delete plan item",
    request: {
      params: z.object({
        planId: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().positive()),
        itemId: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().positive()),
      }),
    },
    responses: {
      204: {
        description: "No Content",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Not Found",
      },
    },
  });

  app.openApiRoute(deleteItemRoute, (c) => {
    const { planId, itemId } = c.req.valid("param");
    const d = getDatabase();

    const item = d
      .query(
        `SELECT i.id FROM meal_plan_item i
         JOIN meal_plan_day d ON i.meal_plan_day_id = d.id
         WHERE i.id = ? AND d.meal_plan_id = ?`
      )
      .get(itemId, planId) as { id: number } | null;

    if (!item) {
      return c.json(err("Item not found"), 404);
    }

    d.run("DELETE FROM meal_plan_item WHERE id = ?", itemId);

    return new Response(null, { status: 204 });
  });
}
