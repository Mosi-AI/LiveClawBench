import { z } from "zod";
import { createRoute, ok, err } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import {
  PlanIdParamSchema,
  IngIdParamSchema,
  IngredientItemSchema,
  CreateIngredientBodySchema,
  UpdateIngredientBodySchema,
  OkSchema,
  ErrSchema,
} from "./schemas";

export function registerIngredientRoutes(
  app: OpenAPIApp,
  getDatabase: () => Database
) {
  // GET /api/meal-plans/:planId/ingredients
  const listIngredientsRoute = createRoute({
    method: "get",
    path: "/api/meal-plans/{planId}/ingredients",
    summary: "List plan ingredients",
    request: {
      params: PlanIdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OkSchema(z.array(IngredientItemSchema)),
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

  app.openApiRoute(listIngredientsRoute, (c) => {
    const { planId } = c.req.valid("param");
    const d = getDatabase();

    const plan = d
      .query("SELECT id FROM meal_plan WHERE id = ?")
      .get(planId) as { id: number } | null;

    if (!plan) {
      return c.json(err("Plan not found"), 404);
    }

    const ingredients = d
      .query(
        `SELECT id, meal_plan_id, name, quantity_value, quantity_unit, notes
         FROM ingredient_item
         WHERE meal_plan_id = ?
         ORDER BY name`
      )
      .all(planId) as Array<{
      id: number;
      meal_plan_id: number;
      name: string;
      quantity_value: number;
      quantity_unit: string;
      notes: string | null;
    }>;

    return c.json(ok(ingredients));
  });

  // POST /api/meal-plans/:planId/ingredients
  const createIngredientRoute = createRoute({
    method: "post",
    path: "/api/meal-plans/{planId}/ingredients",
    summary: "Create ingredient",
    request: {
      params: PlanIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: CreateIngredientBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: OkSchema(IngredientItemSchema),
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

  app.openApiRoute(createIngredientRoute, (c) => {
    const { planId } = c.req.valid("param");
    const body = c.req.valid("json");
    const d = getDatabase();

    const plan = d
      .query("SELECT id FROM meal_plan WHERE id = ?")
      .get(planId) as { id: number } | null;

    if (!plan) {
      return c.json(err("Plan not found"), 404);
    }

    const result = d.run(
      `INSERT INTO ingredient_item (meal_plan_id, name, quantity_value, quantity_unit, notes)
       VALUES (?, ?, ?, ?, ?)`,
      planId,
      body.name,
      body.quantity_value,
      body.quantity_unit,
      body.notes
    );

    const ingredient = d
      .query(
        `SELECT id, meal_plan_id, name, quantity_value, quantity_unit, notes
         FROM ingredient_item WHERE id = ?`
      )
      .get(Number(result.lastInsertRowid)) as {
      id: number;
      meal_plan_id: number;
      name: string;
      quantity_value: number;
      quantity_unit: string;
      notes: string | null;
    };

    return c.json(ok(ingredient), 201);
  });

  // PUT /api/meal-plans/:planId/ingredients/:ingId
  const updateIngredientRoute = createRoute({
    method: "put",
    path: "/api/meal-plans/{planId}/ingredients/{ingId}",
    summary: "Update ingredient",
    request: {
      params: z.object({
        planId: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().positive()),
        ingId: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().positive()),
      }),
      body: {
        content: {
          "application/json": {
            schema: UpdateIngredientBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OkSchema(IngredientItemSchema),
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

  app.openApiRoute(updateIngredientRoute, (c) => {
    const { planId, ingId } = c.req.valid("param");
    const body = c.req.valid("json");
    const d = getDatabase();

    const ingredient = d
      .query(
        "SELECT id FROM ingredient_item WHERE id = ? AND meal_plan_id = ?"
      )
      .get(ingId, planId) as { id: number } | null;

    if (!ingredient) {
      return c.json(err("Ingredient not found"), 404);
    }

    d.run(
      `UPDATE ingredient_item SET
       name = ?, quantity_value = ?, quantity_unit = ?, notes = ?
       WHERE id = ?`,
      body.name,
      body.quantity_value,
      body.quantity_unit,
      body.notes,
      ingId
    );

    const updated = d
      .query(
        `SELECT id, meal_plan_id, name, quantity_value, quantity_unit, notes
         FROM ingredient_item WHERE id = ?`
      )
      .get(ingId) as {
      id: number;
      meal_plan_id: number;
      name: string;
      quantity_value: number;
      quantity_unit: string;
      notes: string | null;
    };

    return c.json(ok(updated));
  });

  // DELETE /api/meal-plans/:planId/ingredients/:ingId
  const deleteIngredientRoute = createRoute({
    method: "delete",
    path: "/api/meal-plans/{planId}/ingredients/{ingId}",
    summary: "Delete ingredient",
    request: {
      params: z.object({
        planId: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().positive()),
        ingId: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().positive()),
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

  app.openApiRoute(deleteIngredientRoute, (c) => {
    const { planId, ingId } = c.req.valid("param");
    const d = getDatabase();

    const ingredient = d
      .query(
        "SELECT id FROM ingredient_item WHERE id = ? AND meal_plan_id = ?"
      )
      .get(ingId, planId) as { id: number } | null;

    if (!ingredient) {
      return c.json(err("Ingredient not found"), 404);
    }

    d.run("DELETE FROM ingredient_item WHERE id = ?", ingId);

    return new Response(null, { status: 204 });
  });
}
