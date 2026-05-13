/** @jsxImportSource hono/jsx */
import { createRoute } from "mock-lib";
import { Layout, PlanDetailPage, PlanForm } from "../components";
import { deletePlan, getPlanDetail, updatePlan } from "../queries";
import { isResponse, parsePositiveInt, runDbMutation } from "./helpers";
import { HtmlResponse, PlanFormSchema, PlanIdParamSchema, RedirectResponse, formRequest } from "./schemas";
import type { MintDietApp, RouteDeps } from "./types";

export function registerPlanDetailRoutes(app: MintDietApp, { getDatabase }: RouteDeps) {
  const updatePlanRoute = createRoute({
    method: "post",
    path: "/plans/{planId}",
    summary: "Update a meal plan",
    request: {
      params: PlanIdParamSchema,
      ...formRequest(PlanFormSchema),
    },
    responses: {
      303: RedirectResponse,
      404: HtmlResponse,
      500: HtmlResponse,
    },
  });

  const deletePlanRoute = createRoute({
    method: "post",
    path: "/plans/{planId}/delete",
    summary: "Delete a meal plan",
    request: {
      params: PlanIdParamSchema,
    },
    responses: {
      303: RedirectResponse,
      404: HtmlResponse,
      500: HtmlResponse,
    },
  });

  app.page("/plans/:planId", async (c) => {
    const planId = parsePositiveInt(c.req.param("planId"));
    if (!planId) return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);

    const d = getDatabase();
    const detail = getPlanDetail(d, planId);
    if (!detail) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

    const tab = c.req.query("tab") ?? "days";
    const { plan, days, itemsByDayBySlot, ingredients } = detail;

    return c.html(
      <PlanDetailPage
        plan={plan}
        days={days}
        itemsByDayBySlot={itemsByDayBySlot}
        ingredients={ingredients}
        tab={tab}
      />
    );
  });

  app.page("/plans/:planId/edit", async (c) => {
    const planId = parsePositiveInt(c.req.param("planId"));
    if (!planId) return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);

    const d = getDatabase();
    const detail = getPlanDetail(d, planId);
    if (!detail) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

    return c.html(<PlanForm plan={detail.plan} />);
  });

  app.openApiRoute(updatePlanRoute, async (c) => {
    const { planId } = c.req.valid("param");
    const d = getDatabase();
    const existing = getPlanDetail(d, planId);
    if (!existing) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

    const body = c.req.valid("form");
    const title = body.title;
    const startDate = body.start_date;
    const endDate = body.end_date;
    const status = body.status;
    const targetCaloriesKcal = body.target_calories_kcal;
    const notes = body.notes;

    const updated = runDbMutation(c, () => updatePlan(d, planId, { title, startDate, endDate, status, targetCaloriesKcal, notes }));
    if (isResponse(updated)) return updated;
    return c.redirect(`/plans/${planId}`, 303);
  });

  app.openApiRoute(deletePlanRoute, async (c) => {
    const { planId } = c.req.valid("param");
    const d = getDatabase();
    const existing = d.query("SELECT id FROM meal_plan WHERE id = ?").get(planId);
    if (!existing) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

    const deleted = runDbMutation(c, () => deletePlan(d, planId));
    if (isResponse(deleted)) return deleted;
    return c.redirect("/plans", 303);
  });
}
