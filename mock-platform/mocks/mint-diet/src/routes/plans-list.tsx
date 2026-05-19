/** @jsxImportSource hono/jsx */
import { createRoute } from "mock-lib";
import { Layout, PlanCard, PlanForm } from "../components";
import { createPlan, listPlans } from "../queries";
import { isResponse, runDbMutation } from "./helpers";
import { HtmlResponse, PlanFormSchema, RedirectResponse, formRequest } from "./schemas";
import type { MintDietApp, RouteDeps } from "./types";

export function registerPlanListRoutes(app: MintDietApp, { getDatabase }: RouteDeps) {
  const createPlanRoute = createRoute({
    method: "post",
    path: "/plans",
    summary: "Create a meal plan",
    request: formRequest(PlanFormSchema),
    responses: {
      303: RedirectResponse,
      500: HtmlResponse,
    },
  });

  app.page("/plans", async (c) => {
    const d = getDatabase();
    const plans = listPlans(d);
    return c.html(
      <Layout title="Meal Plans">
        <h1>Meal Plans</h1>
        <a href="/plans/new" class="btn btn-primary" style="margin-bottom:1rem;display:inline-block">+ New Plan</a>
        {plans.length === 0 && <p class="note">No plans yet.</p>}
        {plans.map(plan => <PlanCard key={plan.id} plan={plan} />)}
      </Layout>
    );
  });

  app.page("/plans/new", (c) => c.html(<PlanForm />));

  app.openApiRoute(createPlanRoute, async (c) => {
    const body = c.req.valid("form");
    const title = body.title;
    const startDate = body.start_date;
    const endDate = body.end_date;
    const status = body.status;
    const targetCaloriesKcal = body.target_calories_kcal;
    const notes = body.notes;

    const d = getDatabase();
    const planId = runDbMutation(c, () => createPlan(d, { title, startDate, endDate, status, targetCaloriesKcal, notes }));
    if (isResponse(planId)) return planId;
    return c.redirect(`/plans/${planId}`, 303);
  });
}
