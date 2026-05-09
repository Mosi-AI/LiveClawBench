import { createRoute } from "mock-lib";
import { Layout, PlanCard, PlanDetailPage, PlanForm, SlotEditorPage } from "../components";
import {
  createPlan,
  deleteIngredientItem,
  deleteMealPlanItem,
  deletePlan,
  getDayByPlanAndDate,
  getIngredientItemForPlan,
  getMealPlanDayById,
  getMealPlanItemForPlan,
  getPlanDetail,
  insertIngredientItem,
  insertMealPlanItem,
  isValidLocalDate,
  listPlans,
  updateIngredientItem,
  updateMealPlanItem,
  updatePlan,
} from "../queries";
import {
  isPlanMealSlot,
  isResponse,
  parsePositiveInt,
  runDbMutation,
} from "./helpers";
import {
  HtmlResponse,
  IngredientFormSchema,
  MealPlanItemFormSchema,
  PlanFormSchema,
  PlanIdParamSchema,
  PlanIngredientParamSchema,
  PlanItemParamSchema,
  RedirectResponse,
  UpdateMealPlanItemFormSchema,
  formRequest,
} from "./schemas";
import type { MintDietApp, RouteDeps } from "./types";

export function registerPlanRoutes(app: MintDietApp, { getDatabase }: RouteDeps) {
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

  const addIngredientRoute = createRoute({
    method: "post",
    path: "/plans/{planId}/ingredients",
    summary: "Add a plan ingredient",
    request: {
      params: PlanIdParamSchema,
      ...formRequest(IngredientFormSchema),
    },
    responses: {
      303: RedirectResponse,
      404: HtmlResponse,
      500: HtmlResponse,
    },
  });

  const updateIngredientRoute = createRoute({
    method: "post",
    path: "/plans/{planId}/ingredients/{ingId}",
    summary: "Update a plan ingredient",
    request: {
      params: PlanIngredientParamSchema,
      ...formRequest(IngredientFormSchema),
    },
    responses: {
      303: RedirectResponse,
      404: HtmlResponse,
      500: HtmlResponse,
    },
  });

  const deleteIngredientRoute = createRoute({
    method: "post",
    path: "/plans/{planId}/ingredients/{ingId}/delete",
    summary: "Delete a plan ingredient",
    request: {
      params: PlanIngredientParamSchema,
    },
    responses: {
      303: RedirectResponse,
      404: HtmlResponse,
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

  app.openApiRoute(addIngredientRoute, async (c) => {
    const { planId } = c.req.valid("param");
    const body = c.req.valid("form");
    const name = body.name;
    const quantityUnit = body.quantity_unit;
    const notes = body.notes;

    const d = getDatabase();
    const existing = getPlanDetail(d, planId);
    if (!existing) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

    const quantityValue = body.quantity_value;
    const inserted = runDbMutation(c, () => insertIngredientItem(d, { mealPlanId: planId, name, quantityValue, quantityUnit, notes }));
    if (isResponse(inserted)) return inserted;
    return c.redirect(`/plans/${planId}?tab=ingredients`, 303);
  });

  app.openApiRoute(updateIngredientRoute, async (c) => {
    const { planId, ingId } = c.req.valid("param");
    const d = getDatabase();
    const ing = getIngredientItemForPlan(d, planId, ingId);
    if (!ing) return c.html(<Layout title="Not Found"><p>Ingredient not found</p></Layout>, 404);

    const body = c.req.valid("form");
    const name = body.name;
    const quantityUnit = body.quantity_unit;
    const notes = body.notes;

    const quantityValue = body.quantity_value;
    const updated = runDbMutation(c, () => updateIngredientItem(d, ingId, { name, quantityValue, quantityUnit, notes }));
    if (isResponse(updated)) return updated;
    return c.redirect(`/plans/${planId}?tab=ingredients`, 303);
  });

  app.openApiRoute(deleteIngredientRoute, async (c) => {
    const { planId, ingId } = c.req.valid("param");
    const d = getDatabase();
    const ing = getIngredientItemForPlan(d, planId, ingId);
    if (!ing) return c.html(<Layout title="Not Found"><p>Ingredient not found</p></Layout>, 404);

    const deleted = runDbMutation(c, () => deleteIngredientItem(d, ingId));
    if (isResponse(deleted)) return deleted;
    return c.redirect(`/plans/${planId}?tab=ingredients`, 303);
  });
}
