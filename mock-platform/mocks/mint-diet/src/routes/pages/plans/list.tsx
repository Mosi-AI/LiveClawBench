import type { OpenAPIApp } from "mock-lib";
import { Layout, PlanCard, PlanForm } from "../../../components";
import { listPlans, createPlan } from "../../../queries";
import {
  isPlanStatus,
  isResponse,
  parseNonNegFloat,
  parseBodyOrBadRequest,
} from "../../helpers";
import type { RouteDeps } from "../../types";

export function registerPlanListRoutes(app: OpenAPIApp, { getDatabase }: RouteDeps) {
  // GET /plans - List all plans
  app.page("/plans", async (c) => {
    const d = getDatabase();
    const plans = listPlans(d);
    return c.html(
      <Layout title="Meal Plans">
        <h1>Meal Plans</h1>
        <a href="/plans/new" class="btn btn-primary" style="margin-bottom:1rem;display:inline-block">+ New Plan</a>
        {plans.length === 0 && <p class="note">No plans yet.</p>}
        {plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
      </Layout>
    );
  });

  // GET /plans/new - New plan form
  app.page("/plans/new", (c) => c.html(<PlanForm />));

  // POST /plans - Create new plan
  app.page("/plans", async (c) => {
    if (c.req.method !== "POST") return c.notFound();

    const body = await parseBodyOrBadRequest(c);
    if (isResponse(body)) return body;

    const title = String(body.title ?? "").trim();
    const startDate = String(body.start_date ?? "");
    const endDate = String(body.end_date ?? "");
    const status = String(body.status ?? "draft");
    const targetRaw = String(body.target_calories_kcal ?? "").trim();
    const notes = String(body.notes ?? "").trim() || null;

    const makePrefill = () => ({
      title,
      start_date: startDate,
      end_date: endDate,
      status,
      target_calories_kcal: targetRaw,
      notes: notes ?? "",
    });

    const d = getDatabase();

    // Validation
    if (!title) {
      return c.html(<PlanForm error="Title is required" prefill={makePrefill()} />, 422);
    }
    if (title.length > 200) {
      return c.html(<PlanForm error="Title must be 200 characters or fewer" prefill={makePrefill()} />, 422);
    }

    // Date validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return c.html(<PlanForm error="Invalid date format" prefill={makePrefill()} />, 422);
    }
    if (startDate > endDate) {
      return c.html(<PlanForm error="Start date must be before end date" prefill={makePrefill()} />, 422);
    }

    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    if (days > 365) {
      return c.html(<PlanForm error="Plan span must be 365 days or fewer" prefill={makePrefill()} />, 422);
    }

    if (!isPlanStatus(status)) {
      return c.html(<PlanForm error="Invalid status" prefill={makePrefill()} />, 422);
    }

    const targetCaloriesKcal = targetRaw ? parseNonNegFloat(targetRaw) : null;
    if (targetRaw && targetCaloriesKcal === null) {
      return c.html(<PlanForm error="Invalid calorie target" prefill={makePrefill()} />, 422);
    }

    const planId = createPlan(d, { title, startDate, endDate, status, targetCaloriesKcal, notes });
    return c.redirect(`/plans/${planId}`, 303);
  });
}
