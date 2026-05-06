import { INGREDIENT_UNITS } from "../constants";
import { IngredientTable, Layout, PlanCard, PlanDetailPage, PlanForm, SlotEditorPage } from "../components";
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
  isPlanStatus,
  isResponse,
  parseBodyOrBadRequest,
  parseNonNegFloat,
  parsePositiveInt,
  runDbMutation,
} from "./helpers";
import type { MintDietApp, RouteDeps } from "./types";

export function registerPlanRoutes(app: MintDietApp, { getDatabase }: RouteDeps) {
  app.get("/plans", async (c) => {
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

  app.get("/plans/new", (c) => c.html(<PlanForm />));

  app.post("/plans", async (c) => {
    const body = await parseBodyOrBadRequest(c);
    if (isResponse(body)) return body;
    const title = String(body.title ?? "").trim();
    const startDate = String(body.start_date ?? "");
    const endDate = String(body.end_date ?? "");
    const status = String(body.status ?? "draft");
    const targetRaw = String(body.target_calories_kcal ?? "").trim();
    const notes = String(body.notes ?? "").trim() || null;

    const makePrefill = () => ({ title, start_date: startDate, end_date: endDate, status, target_calories_kcal: targetRaw, notes: notes ?? "" });

    if (!title) return c.html(<PlanForm error="Title is required" prefill={makePrefill()} />, 422);
    if (title.length > 200) return c.html(<PlanForm error="Title must be 200 characters or fewer" prefill={makePrefill()} />, 422);
    if (!isValidLocalDate(startDate) || !isValidLocalDate(endDate)) return c.html(<PlanForm error="Invalid date format" prefill={makePrefill()} />, 422);
    if (startDate > endDate) return c.html(<PlanForm error="Start date must be before end date" prefill={makePrefill()} />, 422);

    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    if (days > 365) return c.html(<PlanForm error="Plan span must be 365 days or fewer" prefill={makePrefill()} />, 422);

    if (!isPlanStatus(status)) return c.html(<PlanForm error="Invalid status" prefill={makePrefill()} />, 422);

    const targetCaloriesKcal = targetRaw ? parseNonNegFloat(targetRaw) : null;
    if (targetRaw && targetCaloriesKcal === null) return c.html(<PlanForm error="Invalid calorie target" prefill={makePrefill()} />, 422);

    const d = getDatabase();
    const planId = runDbMutation(c, () => createPlan(d, { title, startDate, endDate, status, targetCaloriesKcal, notes }));
    if (isResponse(planId)) return planId;
    return c.redirect(`/plans/${planId}`, 303);
  });

  app.get("/plans/:planId", async (c) => {
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

  app.get("/plans/:planId/edit", async (c) => {
    const planId = parsePositiveInt(c.req.param("planId"));
    if (!planId) return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);

    const d = getDatabase();
    const detail = getPlanDetail(d, planId);
    if (!detail) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

    return c.html(<PlanForm plan={detail.plan} />);
  });

  app.post("/plans/:planId", async (c) => {
    const planId = parsePositiveInt(c.req.param("planId"));
    if (!planId) return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);

    const d = getDatabase();
    const existing = getPlanDetail(d, planId);
    if (!existing) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

    const body = await parseBodyOrBadRequest(c);
    if (isResponse(body)) return body;
    const title = String(body.title ?? "").trim();
    const startDate = String(body.start_date ?? "");
    const endDate = String(body.end_date ?? "");
    const status = String(body.status ?? "draft");
    const targetRaw = String(body.target_calories_kcal ?? "").trim();
    const notes = String(body.notes ?? "").trim() || null;

    const makePrefill = () => ({ title, start_date: startDate, end_date: endDate, status, target_calories_kcal: targetRaw, notes: notes ?? "" });

    if (!title) return c.html(<PlanForm plan={existing.plan} error="Title is required" prefill={makePrefill()} />, 422);
    if (title.length > 200) return c.html(<PlanForm plan={existing.plan} error="Title must be 200 characters or fewer" prefill={makePrefill()} />, 422);
    if (!isValidLocalDate(startDate) || !isValidLocalDate(endDate)) return c.html(<PlanForm plan={existing.plan} error="Invalid date format" prefill={makePrefill()} />, 422);
    if (startDate > endDate) return c.html(<PlanForm plan={existing.plan} error="Start date must be before end date" prefill={makePrefill()} />, 422);

    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    const daySpan = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    if (daySpan > 365) return c.html(<PlanForm plan={existing.plan} error="Plan span must be 365 days or fewer" prefill={makePrefill()} />, 422);
    if (!isPlanStatus(status)) return c.html(<PlanForm plan={existing.plan} error="Invalid status" prefill={makePrefill()} />, 422);

    const targetCaloriesKcal = targetRaw ? parseNonNegFloat(targetRaw) : null;
    if (targetRaw && targetCaloriesKcal === null) return c.html(<PlanForm plan={existing.plan} error="Invalid calorie target" prefill={makePrefill()} />, 422);

    const updated = runDbMutation(c, () => updatePlan(d, planId, { title, startDate, endDate, status, targetCaloriesKcal, notes }));
    if (isResponse(updated)) return updated;
    return c.redirect(`/plans/${planId}`, 303);
  });

  app.post("/plans/:planId/delete", async (c) => {
    const planId = parsePositiveInt(c.req.param("planId"));
    if (!planId) return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);

    const d = getDatabase();
    const existing = d.query("SELECT id FROM meal_plan WHERE id = ?").get(planId);
    if (!existing) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

    const deleted = runDbMutation(c, () => deletePlan(d, planId));
    if (isResponse(deleted)) return deleted;
    return c.redirect("/plans", 303);
  });

  app.get("/plans/:planId/days/:date/slots/:slot/edit", async (c) => {
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

  app.post("/plans/:planId/items", async (c) => {
    const planId = parsePositiveInt(c.req.param("planId"));
    if (!planId) return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);

    const body = await parseBodyOrBadRequest(c);
    if (isResponse(body)) return body;
    const planDate = String(body.plan_date ?? "");
    const mealSlot = String(body.meal_slot ?? "");
    const dishName = String(body.dish_name ?? "").trim();
    const notes = String(body.notes ?? "").trim() || null;

    if (!isValidLocalDate(planDate)) return c.html(<Layout title="Bad Request"><p>Invalid date</p></Layout>, 400);
    if (!isPlanMealSlot(mealSlot)) return c.html(<Layout title="Bad Request"><p>Invalid slot</p></Layout>, 400);

    const d = getDatabase();
    const detail = getPlanDetail(d, planId);
    if (!detail) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

    const day = getDayByPlanAndDate(d, planId, planDate);
    if (!day) return c.html(<Layout title="Not Found"><p>Day not found in plan</p></Layout>, 404);

    if (!dishName) {
      const items = detail.itemsByDayBySlot[day.id]?.[mealSlot] ?? [];
      return c.html(
        <SlotEditorPage plan={detail.plan} day={day} slot={mealSlot} items={items}
          error="Dish name is required"
          prefill={{ dish_name: String(body.dish_name ?? ""), notes: String(body.notes ?? "") }} />,
        422
      );
    }
    if (dishName.length > 200) {
      const items = detail.itemsByDayBySlot[day.id]?.[mealSlot] ?? [];
      return c.html(
        <SlotEditorPage plan={detail.plan} day={day} slot={mealSlot} items={items}
          error="Dish name must be 200 characters or fewer"
          prefill={{ dish_name: String(body.dish_name ?? ""), notes: String(body.notes ?? "") }} />,
        422
      );
    }

    const inserted = runDbMutation(c, () => insertMealPlanItem(d, { mealPlanDayId: day.id, mealSlot, dishName, notes }));
    if (isResponse(inserted)) return inserted;
    return c.redirect(`/plans/${planId}/days/${planDate}/slots/${mealSlot}/edit`, 303);
  });

  app.post("/plans/:planId/items/:itemId", async (c) => {
    const planId = parsePositiveInt(c.req.param("planId"));
    const itemId = parsePositiveInt(c.req.param("itemId"));
    if (!planId || !itemId) return c.html(<Layout title="Bad Request"><p>Invalid ID</p></Layout>, 400);

    const d = getDatabase();
    const item = getMealPlanItemForPlan(d, planId, itemId);
    if (!item) return c.html(<Layout title="Not Found"><p>Item not found</p></Layout>, 404);

    const body = await parseBodyOrBadRequest(c);
    if (isResponse(body)) return body;
    const mealSlot = String(body.meal_slot ?? item.meal_slot);
    const dishName = String(body.dish_name ?? "").trim();
    const notes = String(body.notes ?? "").trim() || null;

    if (!isPlanMealSlot(mealSlot)) return c.html(<Layout title="Bad Request"><p>Invalid slot</p></Layout>, 400);

    const day = getMealPlanDayById(d, item.meal_plan_day_id);
    const planDate = day?.plan_date ?? "";

    const makePrefill = () => ({ dish_name: String(body.dish_name ?? ""), notes: String(body.notes ?? "") });
    if (!dishName) {
      const detail = getPlanDetail(d, planId);
      const items = day ? (detail?.itemsByDayBySlot[day.id]?.[mealSlot] ?? []) : [];
      return c.html(
        <SlotEditorPage
          plan={detail?.plan ?? { id: planId, title: "", start_date: "", end_date: "", status: "draft", target_calories_kcal: null, notes: null }}
          day={day ?? { id: item.meal_plan_day_id, meal_plan_id: planId, plan_date: planDate }}
          slot={mealSlot}
          items={items}
          error="Dish name is required"
          prefill={makePrefill()} />,
        422
      );
    }
    if (dishName.length > 200) {
      const detail = getPlanDetail(d, planId);
      const items = day ? (detail?.itemsByDayBySlot[day.id]?.[mealSlot] ?? []) : [];
      return c.html(
        <SlotEditorPage
          plan={detail?.plan ?? { id: planId, title: "", start_date: "", end_date: "", status: "draft", target_calories_kcal: null, notes: null }}
          day={day ?? { id: item.meal_plan_day_id, meal_plan_id: planId, plan_date: planDate }}
          slot={mealSlot}
          items={items}
          error="Dish name must be 200 characters or fewer"
          prefill={makePrefill()} />,
        422
      );
    }

    const updated = runDbMutation(c, () => updateMealPlanItem(d, itemId, { mealSlot, dishName, notes }));
    if (isResponse(updated)) return updated;
    return c.redirect(`/plans/${planId}/days/${planDate}/slots/${mealSlot}/edit`, 303);
  });

  app.post("/plans/:planId/items/:itemId/delete", async (c) => {
    const planId = parsePositiveInt(c.req.param("planId"));
    const itemId = parsePositiveInt(c.req.param("itemId"));
    if (!planId || !itemId) return c.html(<Layout title="Bad Request"><p>Invalid ID</p></Layout>, 400);

    const d = getDatabase();
    const item = getMealPlanItemForPlan(d, planId, itemId);
    if (!item) return c.html(<Layout title="Not Found"><p>Item not found</p></Layout>, 404);

    const day = getMealPlanDayById(d, item.meal_plan_day_id);
    const planDate = day?.plan_date ?? "";

    const deleted = runDbMutation(c, () => deleteMealPlanItem(d, itemId));
    if (isResponse(deleted)) return deleted;
    return c.redirect(`/plans/${planId}/days/${planDate}/slots/${item.meal_slot}/edit`, 303);
  });

  app.post("/plans/:planId/ingredients", async (c) => {
    const planId = parsePositiveInt(c.req.param("planId"));
    if (!planId) return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);

    const body = await parseBodyOrBadRequest(c);
    if (isResponse(body)) return body;
    const name = String(body.name ?? "").trim();
    const quantityValueRaw = parseNonNegFloat(String(body.quantity_value ?? ""));
    const quantityUnit = String(body.quantity_unit ?? "g");
    const notes = String(body.notes ?? "").trim() || null;

    const d = getDatabase();
    const existing = getPlanDetail(d, planId);
    if (!existing) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

    const makePrefillIng = () => ({ name: String(body.name ?? ""), quantity_value: String(body.quantity_value ?? ""), quantity_unit: quantityUnit });

    const renderIngError = (error: string) => c.html(
      <PlanDetailPage
        plan={existing.plan}
        days={existing.days}
        itemsByDayBySlot={existing.itemsByDayBySlot}
        ingredients={existing.ingredients}
        tab="ingredients"
        ingredientError={error}
        ingredientPrefill={makePrefillIng()}
      />,
      422
    );

    if (!name) return renderIngError("Ingredient name is required");
    if (name.length > 200) return renderIngError("Ingredient name must be 200 characters or fewer");
    if (quantityValueRaw === null || quantityValueRaw < 0) return renderIngError("Invalid quantity value");
    if (!(INGREDIENT_UNITS as readonly string[]).includes(quantityUnit)) return renderIngError("Invalid unit");

    const quantityValue = quantityValueRaw;
    const inserted = runDbMutation(c, () => insertIngredientItem(d, { mealPlanId: planId, name, quantityValue, quantityUnit, notes }));
    if (isResponse(inserted)) return inserted;
    return c.redirect(`/plans/${planId}?tab=ingredients`, 303);
  });

  app.post("/plans/:planId/ingredients/:ingId", async (c) => {
    const planId = parsePositiveInt(c.req.param("planId"));
    const ingId = parsePositiveInt(c.req.param("ingId"));
    if (!planId || !ingId) return c.html(<Layout title="Bad Request"><p>Invalid ID</p></Layout>, 400);

    const d = getDatabase();
    const ing = getIngredientItemForPlan(d, planId, ingId);
    if (!ing) return c.html(<Layout title="Not Found"><p>Ingredient not found</p></Layout>, 404);

    const body = await parseBodyOrBadRequest(c);
    if (isResponse(body)) return body;
    const name = String(body.name ?? "").trim();
    const quantityValueRaw = parseNonNegFloat(String(body.quantity_value ?? ""));
    const quantityUnit = String(body.quantity_unit ?? "g");
    const notes = String(body.notes ?? "").trim() || null;

    const detail = getPlanDetail(d, planId);
    const makePrefillUpd = () => ({ name: String(body.name ?? ""), quantity_value: String(body.quantity_value ?? ""), quantity_unit: quantityUnit });

    const renderUpdError = (error: string) => c.html(
      detail ? (
        <PlanDetailPage
          plan={detail.plan}
          days={detail.days}
          itemsByDayBySlot={detail.itemsByDayBySlot}
          ingredients={detail.ingredients}
          tab="ingredients"
          ingredientError={error}
          ingredientPrefill={makePrefillUpd()}
        />
      ) : (
        <Layout title="Plan">
          <IngredientTable plan={{ id: planId, title: "Plan", start_date: "", end_date: "", status: "draft", target_calories_kcal: null, notes: null }} ingredients={[]} error={error} prefill={makePrefillUpd()} />
        </Layout>
      ),
      422
    );

    if (!name) return renderUpdError("Ingredient name is required");
    if (name.length > 200) return renderUpdError("Ingredient name must be 200 characters or fewer");
    if (quantityValueRaw === null || quantityValueRaw < 0) return renderUpdError("Invalid quantity value");
    if (!(INGREDIENT_UNITS as readonly string[]).includes(quantityUnit)) return renderUpdError("Invalid unit");

    const quantityValue = quantityValueRaw;
    const updated = runDbMutation(c, () => updateIngredientItem(d, ingId, { name, quantityValue, quantityUnit, notes }));
    if (isResponse(updated)) return updated;
    return c.redirect(`/plans/${planId}?tab=ingredients`, 303);
  });

  app.post("/plans/:planId/ingredients/:ingId/delete", async (c) => {
    const planId = parsePositiveInt(c.req.param("planId"));
    const ingId = parsePositiveInt(c.req.param("ingId"));
    if (!planId || !ingId) return c.html(<Layout title="Bad Request"><p>Invalid ID</p></Layout>, 400);

    const d = getDatabase();
    const ing = getIngredientItemForPlan(d, planId, ingId);
    if (!ing) return c.html(<Layout title="Not Found"><p>Ingredient not found</p></Layout>, 404);

    const deleted = runDbMutation(c, () => deleteIngredientItem(d, ingId));
    if (isResponse(deleted)) return deleted;
    return c.redirect(`/plans/${planId}?tab=ingredients`, 303);
  });
}
