import { z } from "zod";
import { createRoute, ok, err } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import {
  createPlan,
  updatePlan,
  deletePlan,
} from "../../queries";
import type { CreatePlanInput } from "../../queries";
import {
  PlanIdParamSchema,
  MealPlanSchema,
  CreateMealPlanBodySchema,
  UpdateMealPlanBodySchema,
  MealPlanDaySchema,
  OkSchema,
  ErrSchema,
} from "./schemas";

export function registerMealPlanRoutes(
  app: OpenAPIApp,
  getDatabase: () => Database
) {
  // GET /api/meal-plans
  const listPlansRoute = createRoute({
    method: "get",
    path: "/api/meal-plans",
    summary: "List all meal plans",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OkSchema(z.array(MealPlanSchema)),
          },
        },
        description: "OK",
      },
    },
  });

  app.openApiRoute(listPlansRoute, (c) => {
    const d = getDatabase();

    const plans = d
      .query(
        `SELECT id, title, start_date, end_date, status,
                target_calories_kcal, notes
         FROM meal_plan
         ORDER BY created_at DESC`
      )
      .all() as Array<{
      id: number;
      title: string;
      start_date: string;
      end_date: string;
      status: string;
      target_calories_kcal: number | null;
      notes: string | null;
    }>;

    return c.json(ok(plans));
  });

  // GET /api/meal-plans/:planId
  const getPlanRoute = createRoute({
    method: "get",
    path: "/api/meal-plans/{planId}",
    summary: "Get meal plan by ID",
    request: {
      params: PlanIdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OkSchema(
              z.object({
                plan: MealPlanSchema,
                days: z.array(MealPlanDaySchema),
              })
            ),
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

  app.openApiRoute(getPlanRoute, (c) => {
    const { planId } = c.req.valid("param");
    const d = getDatabase();

    const plan = d
      .query(
        `SELECT id, title, start_date, end_date, status,
                target_calories_kcal, notes
         FROM meal_plan WHERE id = ?`
      )
      .get(planId) as {
      id: number;
      title: string;
      start_date: string;
      end_date: string;
      status: string;
      target_calories_kcal: number | null;
      notes: string | null;
    } | null;

    if (!plan) {
      return c.json(err("Plan not found"), 404);
    }

    const days = d
      .query(
        `SELECT id, meal_plan_id, plan_date
         FROM meal_plan_day WHERE meal_plan_id = ?
         ORDER BY plan_date`
      )
      .all(planId) as Array<{
      id: number;
      meal_plan_id: number;
      plan_date: string;
    }>;

    return c.json(ok({ plan, days }));
  });

  // POST /api/meal-plans
  const createPlanRoute = createRoute({
    method: "post",
    path: "/api/meal-plans",
    summary: "Create new meal plan",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateMealPlanBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: OkSchema(MealPlanSchema),
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
    },
  });

  app.openApiRoute(createPlanRoute, (c) => {
    const body = c.req.valid("json");
    const d = getDatabase();

    // Calculate days to validate span
    const start = new Date(body.start_date + "T00:00:00");
    const end = new Date(body.end_date + "T00:00:00");
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

    if (days > 365) {
      return c.json(err("Plan span must be 365 days or fewer"), 400);
    }

    const input: CreatePlanInput = {
      title: body.title,
      startDate: body.start_date,
      endDate: body.end_date,
      status: body.status,
      targetCaloriesKcal: body.target_calories_kcal ?? null,
      notes: body.notes ?? null,
    };

    const planId = createPlan(d, input);

    const plan = d
      .query(
        `SELECT id, title, start_date, end_date, status,
                target_calories_kcal, notes
         FROM meal_plan WHERE id = ?`
      )
      .get(planId) as {
      id: number;
      title: string;
      start_date: string;
      end_date: string;
      status: string;
      target_calories_kcal: number | null;
      notes: string | null;
    };

    return c.json(ok(plan), 201);
  });

  // PUT /api/meal-plans/:planId
  const updatePlanRoute = createRoute({
    method: "put",
    path: "/api/meal-plans/{planId}",
    summary: "Update meal plan",
    request: {
      params: PlanIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateMealPlanBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OkSchema(MealPlanSchema),
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

  app.openApiRoute(updatePlanRoute, (c) => {
    const { planId } = c.req.valid("param");
    const body = c.req.valid("json");
    const d = getDatabase();

    const existing = d
      .query("SELECT id FROM meal_plan WHERE id = ?")
      .get(planId) as { id: number } | null;

    if (!existing) {
      return c.json(err("Plan not found"), 404);
    }

    // Calculate days to validate span
    const start = new Date(body.start_date + "T00:00:00");
    const end = new Date(body.end_date + "T00:00:00");
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

    if (days > 365) {
      return c.json(err("Plan span must be 365 days or fewer"), 400);
    }

    const input: CreatePlanInput = {
      title: body.title,
      startDate: body.start_date,
      endDate: body.end_date,
      status: body.status,
      targetCaloriesKcal: body.target_calories_kcal ?? null,
      notes: body.notes ?? null,
    };

    updatePlan(d, planId, input);

    const plan = d
      .query(
        `SELECT id, title, start_date, end_date, status,
                target_calories_kcal, notes
         FROM meal_plan WHERE id = ?`
      )
      .get(planId) as {
      id: number;
      title: string;
      start_date: string;
      end_date: string;
      status: string;
      target_calories_kcal: number | null;
      notes: string | null;
    };

    return c.json(ok(plan));
  });

  // DELETE /api/meal-plans/:planId
  const deletePlanRoute = createRoute({
    method: "delete",
    path: "/api/meal-plans/{planId}",
    summary: "Delete meal plan",
    request: {
      params: PlanIdParamSchema,
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

  app.openApiRoute(deletePlanRoute, (c) => {
    const { planId } = c.req.valid("param");
    const d = getDatabase();

    const existing = d
      .query("SELECT id FROM meal_plan WHERE id = ?")
      .get(planId) as { id: number } | null;

    if (!existing) {
      return c.json(err("Plan not found"), 404);
    }

    deletePlan(d, planId);

    return new Response(null, { status: 204 });
  });
}
