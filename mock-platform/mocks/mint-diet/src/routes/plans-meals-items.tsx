/** @jsxImportSource hono/jsx */
import { createRoute } from "mock-lib";
import { Layout, SlotEditorPage } from "../components";
import {
  deleteMealPlanItem,
  getDayByPlanAndDate,
  getMealPlanDayById,
  getMealPlanItemForPlan,
  getPlanDetail,
  insertMealPlanItem,
  isValidLocalDate,
  updateMealPlanItem,
} from "../queries";
import { isPlanMealSlot, isResponse, parsePositiveInt, runDbMutation } from "./helpers";
import {
  HtmlResponse,
  MealPlanItemFormSchema,
  PlanIdParamSchema,
  PlanItemParamSchema,
  RedirectResponse,
  UpdateMealPlanItemFormSchema,
  formRequest,
} from "./schemas";
import type { MintDietApp, RouteDeps } from "./types";

export function registerPlanMealItemRoutes(app: MintDietApp, { getDatabase }: RouteDeps) {
  const addPlanItemRoute = createRoute({
    method: "post",
    path: "/plans/{planId}/items",
    summary: "Add a meal plan item",
    request: {
      params: PlanIdParamSchema,
      ...formRequest(MealPlanItemFormSchema),
    },
    responses: {
      303: RedirectResponse,
      404: HtmlResponse,
      500: HtmlResponse,
    },
  });

  const updatePlanItemRoute = createRoute({
    method: "post",
    path: "/plans/{planId}/items/{itemId}",
    summary: "Update a meal plan item",
    request: {
      params: PlanItemParamSchema,
      ...formRequest(UpdateMealPlanItemFormSchema),
    },
    responses: {
      303: RedirectResponse,
      404: HtmlResponse,
      500: HtmlResponse,
    },
  });

  const deletePlanItemRoute = createRoute({
    method: "post",
    path: "/plans/{planId}/items/{itemId}/delete",
    summary: "Delete a meal plan item",
    request: {
      params: PlanItemParamSchema,
    },
    responses: {
      303: RedirectResponse,
      404: HtmlResponse,
      500: HtmlResponse,
    },
  });

  app.page("/plans/:planId/days/:date/slots/:slot/edit", async (c) => {
    const planId = parsePositiveInt(c.req.param("planId"));
    if (!planId) return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);
    const { date, slot } = c.req.param();
    if (!isValidLocalDate(date)) return c.html(<Layout title="Bad Request"><p>Invalid date</p></Layout>, 400);
    if (!isPlanMealSlot(slot)) return c.html(<Layout title="Bad Request"><p>Invalid slot</p></Layout>, 400);

    const d = getDatabase();
    const detail = getPlanDetail(d, planId);
    if (!detail) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

    const day = getDayByPlanAndDate(d, planId, date);
    if (!day) return c.html(<Layout title="Not Found"><p>Day not found in plan</p></Layout>, 404);

    const items = detail.itemsByDayBySlot[day.id]?.[slot] ?? [];
    return c.html(<SlotEditorPage plan={detail.plan} day={day} slot={slot} items={items} />);
  });

  app.openApiRoute(addPlanItemRoute, async (c) => {
    const { planId } = c.req.valid("param");
    const body = c.req.valid("form");
    const planDate = body.plan_date;
    const mealSlot = body.meal_slot;
    const dishName = body.dish_name;
    const notes = body.notes;

    const d = getDatabase();
    const detail = getPlanDetail(d, planId);
    if (!detail) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

    const day = getDayByPlanAndDate(d, planId, planDate);
    if (!day) return c.html(<Layout title="Not Found"><p>Day not found in plan</p></Layout>, 404);

    const inserted = runDbMutation(c, () => insertMealPlanItem(d, { mealPlanDayId: day.id, mealSlot, dishName, notes }));
    if (isResponse(inserted)) return inserted;
    return c.redirect(`/plans/${planId}/days/${planDate}/slots/${mealSlot}/edit`, 303);
  });

  app.openApiRoute(updatePlanItemRoute, async (c) => {
    const { planId, itemId } = c.req.valid("param");
    const d = getDatabase();
    const item = getMealPlanItemForPlan(d, planId, itemId);
    if (!item) return c.html(<Layout title="Not Found"><p>Item not found</p></Layout>, 404);

    const body = c.req.valid("form");
    const mealSlot = body.meal_slot;
    const dishName = body.dish_name;
    const notes = body.notes;

    const day = getMealPlanDayById(d, item.meal_plan_day_id);
    const planDate = day?.plan_date ?? "";

    const updated = runDbMutation(c, () => updateMealPlanItem(d, itemId, { mealSlot, dishName, notes }));
    if (isResponse(updated)) return updated;
    return c.redirect(`/plans/${planId}/days/${planDate}/slots/${mealSlot}/edit`, 303);
  });

  app.openApiRoute(deletePlanItemRoute, async (c) => {
    const { planId, itemId } = c.req.valid("param");
    const d = getDatabase();
    const item = getMealPlanItemForPlan(d, planId, itemId);
    if (!item) return c.html(<Layout title="Not Found"><p>Item not found</p></Layout>, 404);

    const day = getMealPlanDayById(d, item.meal_plan_day_id);
    const planDate = day?.plan_date ?? "";

    const deleted = runDbMutation(c, () => deleteMealPlanItem(d, itemId));
    if (isResponse(deleted)) return deleted;
    return c.redirect(`/plans/${planId}/days/${planDate}/slots/${item.meal_slot}/edit`, 303);
  });
}
