import type { OpenAPIApp } from "mock-lib";
import { Layout, PlanForm, PlanDetailPage } from "../../../components";
import {
  getPlanDetail,
  updatePlan,
  deletePlan,
} from "../../../queries";
import {
  isPlanStatus,
  isResponse,
  parseNonNegFloat,
  parsePositiveInt,
  runDbMutation,
  parseBodyOrBadRequest,
} from "../../helpers";
import type { RouteDeps } from "../../types";

export function registerPlanDetailRoutes(app: OpenAPIApp, { getDatabase }: RouteDeps) {
  // GET /plans/:planId - Plan detail
  app.page("/plans/:planId", async (c) => {
    const planId = parsePositiveInt(c.req.param("planId"));
    if (!planId) {
      return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);
    }

    const d = getDatabase();
    const detail = getPlanDetail(d, planId);
    if (!detail) {
      return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);
    }

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

  // GET /plans/:planId/edit - Edit plan form
  app.page("/plans/:planId/edit", async (c) => {
    const planId = parsePositiveInt(c.req.param("planId"));
    if (!planId) {
      return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);
    }

    const d = getDatabase();
    const detail = getPlanDetail(d, planId);
    if (!detail) {
      return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);
    }

    return c.html(<PlanForm plan={detail.plan} />);
  });

  // POST /plans/:planId - Update plan
  app.page("/plans/:planId", async (c) => {
    if (c.req.method !== "POST") return c.notFound();

    const planId = parsePositiveInt(c.req.param("planId"));
    if (!planId) {
      return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);
    }

    const d = getDatabase();
    const existing = getPlanDetail(d, planId);
    if (!existing) {
      return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);
    }

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

    // Validation
    if (!title) {
      return c.html(<PlanForm plan={existing.plan} error="Title is required" prefill={makePrefill()} />, 422);
    }
    if (title.length > 200) {
      return c.html(<PlanForm plan={existing.plan} error="Title must be 200 characters or fewer" prefill={makePrefill()} />, 422);
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return c.html(<PlanForm plan={existing.plan} error="Invalid date format" prefill={makePrefill()} />, 422);
    }
    if (startDate > endDate) {
      return c.html(<PlanForm plan={existing.plan} error="Start date must be before end date" prefill={makePrefill()} />, 422);
    }

    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    const daySpan = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    if (daySpan > 365) {
      return c.html(<PlanForm plan={existing.plan} error="Plan span must be 365 days or fewer" prefill={makePrefill()} />, 422);
    }

    if (!isPlanStatus(status)) {
      return c.html(<PlanForm plan={existing.plan} error="Invalid status" prefill={makePrefill()} />, 422);
    }

    const targetCaloriesKcal = targetRaw ? parseNonNegFloat(targetRaw) : null;
    if (targetRaw && targetCaloriesKcal === null) {
      return c.html(<PlanForm plan={existing.plan} error="Invalid calorie target" prefill={makePrefill()} />, 422);
    }

    const updated = runDbMutation(c, () =>
      updatePlan(d, planId, { title, startDate, endDate, status, targetCaloriesKcal, notes })
    );
    if (isResponse(updated)) return updated;

    return c.redirect(`/plans/${planId}`, 303);
  });

  // POST /plans/:planId/delete - Delete plan
  app.page("/plans/:planId/delete", async (c) => {
    if (c.req.method !== "POST") return c.notFound();

    const planId = parsePositiveInt(c.req.param("planId"));
    if (!planId) {
      return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);
    }

    const d = getDatabase();
    const existing = d.query("SELECT id FROM meal_plan WHERE id = ?").get(planId) as { id: number } | null;
    if (!existing) {
      return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);
    }

    const deleted = runDbMutation(c, () => deletePlan(d, planId));
    if (isResponse(deleted)) return deleted;

    return c.redirect("/plans", 303);
  });
}
