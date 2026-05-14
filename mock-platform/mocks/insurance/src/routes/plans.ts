import { z } from "zod";
import { createRoute, err } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { ErrorResponseSchema } from "mock-lib";

const IdParamSchema = z.string().regex(/^\d+$/);

const PlanSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  effective_year: z.number(),
  premium_monthly: z.number(),
  deductible: z.number(),
});

const PlanWithBenefitsSchema = PlanSchema.extend({
  benefits: z.array(
    z.object({
      id: z.number(),
      benefit_category: z.string(),
      coverage_type: z.string(),
      coverage_value: z.number().nullable(),
      notes: z.string().nullable(),
    }),
  ),
});

const PlanSelectionSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  plan_id: z.number(),
  year: z.number(),
  plan_code_snapshot: z.string(),
  plan_name_snapshot: z.string(),
  deductible_snapshot: z.number(),
  premium_snapshot: z.number(),
  selected_at: z.string(),
});

const CurrentPolicySchema = z.object({
  id: z.number(),
  user_id: z.number(),
  plan_id: z.number(),
  status: z.string(),
  plan: PlanSchema,
});

export function registerPlansRoutes(app: OpenAPIApp, db: Database): void {
  // GET /api/policies/current
  const currentPolicyRoute = createRoute({
    method: "get",
    path: "/api/policies/current",
    summary: "Get current active policy",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CurrentPolicySchema,
          },
        },
        description: "Current active policy",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "No active policy",
      },
    },
  });

  app.openApiRoute(currentPolicyRoute, (c): any => {
    const userId = c.get("userId");
    const policy = db
      .query<
        {
          id: number;
          user_id: number;
          plan_id: number;
          status: string;
        },
        [number]
      >("SELECT id, user_id, plan_id, status FROM current_policy WHERE user_id = ? AND status = 'active'")
      .get(userId!);

    if (!policy) {
      return c.json(err("no_active_policy"), 404);
    }

    const plan = db
      .query<
        { id: number; code: string; name: string; description: string | null; effective_year: number; premium_monthly: number; deductible: number },
        [number]
      >("SELECT id, code, name, description, effective_year, premium_monthly, deductible FROM insurance_plan WHERE id = ?")
      .get(policy.plan_id);

    return c.json({ ...policy, plan });
  }, { auth: "required" });

  // GET /api/plans
  const listPlansRoute = createRoute({
    method: "get",
    path: "/api/plans",
    summary: "List insurance plans",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ plans: z.array(PlanSchema) }),
          },
        },
        description: "List of plans",
      },
    },
  });

  app.openApiRoute(listPlansRoute, (c) => {
    const plans = db
      .query<
        { id: number; code: string; name: string; description: string | null; effective_year: number; premium_monthly: number; deductible: number },
        []
      >("SELECT id, code, name, description, effective_year, premium_monthly, deductible FROM insurance_plan ORDER BY code")
      .all();
    return c.json({ plans });
  });

  // GET /api/plans/:id
  const getPlanRoute = createRoute({
    method: "get",
    path: "/api/plans/{id}",
    summary: "Get plan with benefits",
    request: {
      params: z.object({ id: IdParamSchema }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PlanWithBenefitsSchema,
          },
        },
        description: "Plan details",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Plan not found",
      },
    },
  });

  app.openApiRoute(getPlanRoute, (c): any => {
    const id = Number(c.req.param("id"));
    const plan = db
      .query<
        { id: number; code: string; name: string; description: string | null; effective_year: number; premium_monthly: number; deductible: number },
        [number]
      >("SELECT id, code, name, description, effective_year, premium_monthly, deductible FROM insurance_plan WHERE id = ?")
      .get(id);

    if (!plan) {
      return c.json(err("Plan not found"), 404);
    }

    const benefits = db
      .query<
        { id: number; benefit_category: string; coverage_type: string; coverage_value: number | null; notes: string | null },
        [number]
      >("SELECT id, benefit_category, coverage_type, coverage_value, notes FROM plan_benefit WHERE plan_id = ?")
      .all(id);

    return c.json({ ...plan, benefits });
  });

  // POST /api/plans/:id/select
  const selectPlanRoute = createRoute({
    method: "post",
    path: "/api/plans/{id}/select",
    summary: "Select a plan (snapshot freeze)",
    request: {
      params: z.object({ id: IdParamSchema }),
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: PlanSelectionSchema,
          },
        },
        description: "Plan selected",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Plan not found",
      },
    },
  });

  app.openApiRoute(selectPlanRoute, (c): any => {
    const userId = c.get("userId")!;
    const id = Number(c.req.param("id"));

    const plan = db
      .query<
        { id: number; code: string; name: string; effective_year: number; premium_monthly: number; deductible: number },
        [number]
      >("SELECT id, code, name, effective_year, premium_monthly, deductible FROM insurance_plan WHERE id = ?")
      .get(id);

    if (!plan) {
      return c.json(err("Plan not found"), 404);
    }

    // Update active policy: terminate old, insert new
    db.query(
      `UPDATE current_policy SET status = 'terminated', updated_at = datetime('now') WHERE user_id = ? AND status = 'active'`,
    ).run(userId);
    db.query(
      `INSERT INTO current_policy (user_id, plan_id, status) VALUES (?, ?, 'active')`,
    ).run(userId, plan.id);

    // Record the selection event with snapshots
    const insertResult = db.query(
      `INSERT INTO plan_selection
       (user_id, plan_id, year, plan_code_snapshot, plan_name_snapshot, deductible_snapshot, premium_snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      userId,
      plan.id,
      plan.effective_year,
      plan.code,
      plan.name,
      plan.deductible,
      plan.premium_monthly,
    );

    const selection = db
      .query<
        {
          id: number;
          user_id: number;
          plan_id: number;
          year: number;
          plan_code_snapshot: string;
          plan_name_snapshot: string;
          deductible_snapshot: number;
          premium_snapshot: number;
          selected_at: string;
        },
        [number]
      >("SELECT * FROM plan_selection WHERE id = ?")
      .get(Number(insertResult.lastInsertRowid));

    return c.json(selection, 201);
  }, { auth: "required" });
}
