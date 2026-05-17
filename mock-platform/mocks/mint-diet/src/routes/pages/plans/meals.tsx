import type { OpenAPIApp } from "mock-lib";
import {
  Layout,
  PlanDetailPage,
  SlotEditorPage,
  IngredientTable,
} from "../../../components";
import { INGREDIENT_UNITS } from "../../../constants";
import {
  isValidLocalDate,
  getPlanDetail,
  getDayByPlanAndDate,
  getMealPlanItemForPlan,
  getMealPlanDayById,
  getIngredientItemForPlan,
  insertMealPlanItem,
  updateMealPlanItem,
  deleteMealPlanItem,
  insertIngredientItem,
  updateIngredientItem,
  deleteIngredientItem,
} from "../../../queries";
import {
  isPlanMealSlot,
  isResponse,
  parseNonNegFloat,
  parsePositiveInt,
  runDbMutation,
  parseBodyOrBadRequest,
} from "../../helpers";
import type { RouteDeps } from "../../types";

export function registerPlanMealsRoutes(app: OpenAPIApp, { getDatabase }: RouteDeps) {
  // GET /plans/:planId/days/:date/slots/:slot/edit - Edit slot
  app.page("/plans/:planId/days/:date/slots/:slot/edit", async (c) => {
    const planId = parsePositiveInt(c.req.param("planId"));
    if (!planId) {
      return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);
    }

    const { date, slot } = c.req.param();
    if (!isValidLocalDate(date)) {
      return c.html(<Layout title="Bad Request"><p>Invalid date</p></Layout>, 400);
    }
    if (!isPlanMealSlot(slot)) {
      return c.html(<Layout title="Bad Request"><p>Invalid slot</p></Layout>, 400);
    }

    const d = getDatabase();
    const detail = getPlanDetail(d, planId);
    if (!detail) {
      return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);
    }

    const day = getDayByPlanAndDate(d, planId, date);
    if (!day) {
      return c.html(<Layout title="Not Found"><p>Day not found in plan</p></Layout>, 404);
    }

    const items = detail.itemsByDayBySlot[day.id]?.[slot] ?? [];
    return c.html(<SlotEditorPage plan={detail.plan} day={day} slot={slot} items={items} />);
  });

  // POST /plans/:planId/items - Create item
  app.page("/plans/:planId/items", async (c) => {
    if (c.req.method !== "POST") return c.notFound();

    const planId = parsePositiveInt(c.req.param("planId"));
    if (!planId) {
      return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);
    }

    const body = await parseBodyOrBadRequest(c);
    if (isResponse(body)) return body;

    const planDate = String(body.plan_date ?? "");
    const mealSlot = String(body.meal_slot ?? "");
    const dishName = String(body.dish_name ?? "").trim();
    const notes = String(body.notes ?? "").trim() || null;

    const d = getDatabase();
    const detail = getPlanDetail(d, planId);
    if (!detail) {
      return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);
    }

    const day = getDayByPlanAndDate(d, planId, planDate);
    if (!day) {
      return c.html(<Layout title="Not Found"><p>Day not found in plan</p></Layout>, 404);
    }

    // Validation
    if (!dishName) {
      const items = detail.itemsByDayBySlot[day.id]?.[mealSlot] ?? [];
      return c.html(
        <SlotEditorPage
          plan={detail.plan}
          day={day}
          slot={mealSlot}
          items={items}
          error="Dish name is required"
          prefill={{ dish_name: String(body.dish_name ?? ""), notes: String(body.notes ?? "") }}
        />,
        422
      );
    }

    if (dishName.length > 200) {
      const items = detail.itemsByDayBySlot[day.id]?.[mealSlot] ?? [];
      return c.html(
        <SlotEditorPage
          plan={detail.plan}
          day={day}
          slot={mealSlot}
          items={items}
          error="Dish name must be 200 characters or fewer"
          prefill={{ dish_name: String(body.dish_name ?? ""), notes: String(body.notes ?? "") }}
        />,
        422
      );
    }

    const inserted = runDbMutation(c, () =>
      insertMealPlanItem(d, { mealPlanDayId: day.id, mealSlot, dishName, notes })
    );
    if (isResponse(inserted)) return inserted;

    return c.redirect(`/plans/${planId}/days/${planDate}/slots/${mealSlot}/edit`, 303);
  });

  // POST /plans/:planId/items/:itemId - Update item
  app.page("/plans/:planId/items/:itemId", async (c) => {
    if (c.req.method !== "POST") return c.notFound();

    const planId = parsePositiveInt(c.req.param("planId"));
    const itemId = parsePositiveInt(c.req.param("itemId"));
    if (!planId || !itemId) {
      return c.html(<Layout title="Bad Request"><p>Invalid ID</p></Layout>, 400);
    }

    const d = getDatabase();
    const item = getMealPlanItemForPlan(d, planId, itemId);
    if (!item) {
      return c.html(<Layout title="Not Found"><p>Item not found</p></Layout>, 404);
    }

    const body = await parseBodyOrBadRequest(c);
    if (isResponse(body)) return body;

    const mealSlot = String(body.meal_slot ?? item.meal_slot);
    const dishName = String(body.dish_name ?? "").trim();
    const notes = String(body.notes ?? "").trim() || null;

    if (!isPlanMealSlot(mealSlot)) {
      return c.html(<Layout title="Bad Request"><p>Invalid slot</p></Layout>, 400);
    }

    const day = getMealPlanDayById(d, item.meal_plan_day_id);
    const planDate = day?.plan_date ?? "";

    // Validation
    if (!dishName) {
      const detail = getPlanDetail(d, planId);
      const items = day ? (detail?.itemsByDayBySlot[day.id]?.[mealSlot] ?? []) : [];
      return c.html(
        <SlotEditorPage
          plan={detail?.plan ?? { id: planId, title: "Plan", start_date: "", end_date: "", status: "draft", target_calories_kcal: null, notes: null }}
          day={day ?? { id: item.meal_plan_day_id, meal_plan_id: planId, plan_date: planDate }}
          slot={mealSlot}
          items={items}
          error="Dish name is required"
          prefill={{ dish_name: String(body.dish_name ?? ""), notes: String(body.notes ?? "") }}
        />,
        422
      );
    }

    if (dishName.length > 200) {
      const detail = getPlanDetail(d, planId);
      const items = day ? (detail?.itemsByDayBySlot[day.id]?.[mealSlot] ?? []) : [];
      return c.html(
        <SlotEditorPage
          plan={detail?.plan ?? { id: planId, title: "Plan", start_date: "", end_date: "", status: "draft", target_calories_kcal: null, notes: null }}
          day={day ?? { id: item.meal_plan_day_id, meal_plan_id: planId, plan_date: planDate }}
          slot={mealSlot}
          items={items}
          error="Dish name must be 200 characters or fewer"
          prefill={{ dish_name: String(body.dish_name ?? ""), notes: String(body.notes ?? "") }}
        />,
        422
      );
    }

    const updated = runDbMutation(c, () =>
      updateMealPlanItem(d, itemId, { mealSlot, dishName, notes })
    );
    if (isResponse(updated)) return updated;

    return c.redirect(`/plans/${planId}/days/${planDate}/slots/${mealSlot}/edit`, 303);
  });

  // POST /plans/:planId/items/:itemId/delete - Delete item
  app.page("/plans/:planId/items/:itemId/delete", async (c) => {
    if (c.req.method !== "POST") return c.notFound();

    const planId = parsePositiveInt(c.req.param("planId"));
    const itemId = parsePositiveInt(c.req.param("itemId"));
    if (!planId || !itemId) {
      return c.html(<Layout title="Bad Request"><p>Invalid ID</p></Layout>, 400);
    }

    const d = getDatabase();
    const item = getMealPlanItemForPlan(d, planId, itemId);
    if (!item) {
      return c.html(<Layout title="Not Found"><p>Item not found</p></Layout>, 404);
    }

    const day = getMealPlanDayById(d, item.meal_plan_day_id);
    const planDate = day?.plan_date ?? "";

    const deleted = runDbMutation(c, () => deleteMealPlanItem(d, itemId));
    if (isResponse(deleted)) return deleted;

    return c.redirect(`/plans/${planId}/days/${planDate}/slots/${item.meal_slot}/edit`, 303);
  });

  // POST /plans/:planId/ingredients - Create ingredient
  app.page("/plans/:planId/ingredients", async (c) => {
    if (c.req.method !== "POST") return c.notFound();

    const planId = parsePositiveInt(c.req.param("planId"));
    if (!planId) {
      return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);
    }

    const body = await parseBodyOrBadRequest(c);
    if (isResponse(body)) return body;

    const name = String(body.name ?? "").trim();
    const quantityValueRaw = parseNonNegFloat(String(body.quantity_value ?? ""));
    const quantityUnit = String(body.quantity_unit ?? "g");
    const notes = String(body.notes ?? "").trim() || null;

    const d = getDatabase();
    const existing = getPlanDetail(d, planId);
    if (!existing) {
      return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);
    }

    const makePrefillIng = () => ({
      name: String(body.name ?? ""),
      quantity_value: String(body.quantity_value ?? ""),
      quantity_unit: quantityUnit,
    });

    const renderIngError = (error: string) =>
      c.html(
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

    // Validation
    if (!name) return renderIngError("Ingredient name is required");
    if (name.length > 200) return renderIngError("Ingredient name must be 200 characters or fewer");
    if (quantityValueRaw === null || quantityValueRaw < 0) return renderIngError("Invalid quantity value");
    if (!(INGREDIENT_UNITS as readonly string[]).includes(quantityUnit)) return renderIngError("Invalid unit");

    const inserted = runDbMutation(c, () =>
      insertIngredientItem(d, { mealPlanId: planId, name, quantityValue: quantityValueRaw, quantityUnit, notes })
    );
    if (isResponse(inserted)) return inserted;

    return c.redirect(`/plans/${planId}?tab=ingredients`, 303);
  });

  // POST /plans/:planId/ingredients/:ingId - Update ingredient
  app.page("/plans/:planId/ingredients/:ingId", async (c) => {
    if (c.req.method !== "POST") return c.notFound();

    const planId = parsePositiveInt(c.req.param("planId"));
    const ingId = parsePositiveInt(c.req.param("ingId"));
    if (!planId || !ingId) {
      return c.html(<Layout title="Bad Request"><p>Invalid ID</p></Layout>, 400);
    }

    const d = getDatabase();
    const ing = getIngredientItemForPlan(d, planId, ingId);
    if (!ing) {
      return c.html(<Layout title="Not Found"><p>Ingredient not found</p></Layout>, 404);
    }

    const body = await parseBodyOrBadRequest(c);
    if (isResponse(body)) return body;

    const name = String(body.name ?? "").trim();
    const quantityValueRaw = parseNonNegFloat(String(body.quantity_value ?? ""));
    const quantityUnit = String(body.quantity_unit ?? "g");
    const notes = String(body.notes ?? "").trim() || null;

    const detail = getPlanDetail(d, planId);
    const makePrefillUpd = () => ({
      name: String(body.name ?? ""),
      quantity_value: String(body.quantity_value ?? ""),
      quantity_unit: quantityUnit,
    });

    const renderUpdError = (error: string) =>
      c.html(
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
            <IngredientTable
              plan={{ id: planId, title: "Plan", start_date: "", end_date: "", status: "draft", target_calories_kcal: null, notes: null }}
              ingredients={[]}
              error={error}
              prefill={makePrefillUpd()}
            />
          </Layout>
        ),
        422
      );

    // Validation
    if (!name) return renderUpdError("Ingredient name is required");
    if (name.length > 200) return renderUpdError("Ingredient name must be 200 characters or fewer");
    if (quantityValueRaw === null || quantityValueRaw < 0) return renderUpdError("Invalid quantity value");
    if (!(INGREDIENT_UNITS as readonly string[]).includes(quantityUnit)) return renderUpdError("Invalid unit");

    const updated = runDbMutation(c, () =>
      updateIngredientItem(d, ingId, { name, quantityValue: quantityValueRaw, quantityUnit, notes })
    );
    if (isResponse(updated)) return updated;

    return c.redirect(`/plans/${planId}?tab=ingredients`, 303);
  });

  // POST /plans/:planId/ingredients/:ingId/delete - Delete ingredient
  app.page("/plans/:planId/ingredients/:ingId/delete", async (c) => {
    if (c.req.method !== "POST") return c.notFound();

    const planId = parsePositiveInt(c.req.param("planId"));
    const ingId = parsePositiveInt(c.req.param("ingId"));
    if (!planId || !ingId) {
      return c.html(<Layout title="Bad Request"><p>Invalid ID</p></Layout>, 400);
    }

    const d = getDatabase();
    const ing = getIngredientItemForPlan(d, planId, ingId);
    if (!ing) {
      return c.html(<Layout title="Not Found"><p>Ingredient not found</p></Layout>, 404);
    }

    const deleted = runDbMutation(c, () => deleteIngredientItem(d, ingId));
    if (isResponse(deleted)) return deleted;

    return c.redirect(`/plans/${planId}?tab=ingredients`, 303);
  });
}
