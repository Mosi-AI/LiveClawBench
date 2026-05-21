import type { OpenAPIApp } from "mock-lib";
import { Layout, SlotEditorPage } from "../../../components";
import {
  deleteMealPlanItem,
  getDayByPlanAndDate,
  getMealPlanDayById,
  getMealPlanItemForPlan,
  getPlanDetail,
  insertMealPlanItem,
  updateMealPlanItem,
} from "../../../queries";
import {
  isPlanMealSlot,
  isResponse,
  parseBodyOrBadRequest,
  parsePositiveInt,
  runDbMutation,
} from "../../helpers";
import type { RouteDeps } from "../../types";

export function registerPlanItemPageRoutes(app: OpenAPIApp, { getDatabase }: RouteDeps) {
  app.page("/plans/:planId/items", async (c) => {
    if (c.req.method !== "POST") return c.notFound();

    const planId = parsePositiveInt(c.req.param("planId"));
    if (!planId) return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);

    const body = await parseBodyOrBadRequest(c);
    if (isResponse(body)) return body;

    const planDate = String(body.plan_date ?? "");
    const mealSlot = String(body.meal_slot ?? "");
    const dishName = String(body.dish_name ?? "").trim();
    const notes = String(body.notes ?? "").trim() || null;

    const d = getDatabase();
    const detail = getPlanDetail(d, planId);
    if (!detail) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

    const day = getDayByPlanAndDate(d, planId, planDate);
    if (!day) return c.html(<Layout title="Not Found"><p>Day not found in plan</p></Layout>, 404);

    if (!dishName || dishName.length > 200) {
      const error = !dishName
        ? "Dish name is required"
        : "Dish name must be 200 characters or fewer";
      const items = detail.itemsByDayBySlot[day.id]?.[mealSlot] ?? [];
      return c.html(
        <SlotEditorPage
          plan={detail.plan}
          day={day}
          slot={mealSlot}
          items={items}
          error={error}
          prefill={{ dish_name: String(body.dish_name ?? ""), notes: String(body.notes ?? "") }}
        />,
        422,
      );
    }

    const inserted = runDbMutation(c, () =>
      insertMealPlanItem(d, { mealPlanDayId: day.id, mealSlot, dishName, notes })
    );
    if (isResponse(inserted)) return inserted;

    return c.redirect(`/plans/${planId}/days/${planDate}/slots/${mealSlot}/edit`, 303);
  });

  app.page("/plans/:planId/items/:itemId", async (c) => {
    if (c.req.method !== "POST") return c.notFound();

    const planId = parsePositiveInt(c.req.param("planId"));
    const itemId = parsePositiveInt(c.req.param("itemId"));
    if (!planId || !itemId) {
      return c.html(<Layout title="Bad Request"><p>Invalid ID</p></Layout>, 400);
    }

    const d = getDatabase();
    const item = getMealPlanItemForPlan(d, planId, itemId);
    if (!item) return c.html(<Layout title="Not Found"><p>Item not found</p></Layout>, 404);

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

    if (!dishName || dishName.length > 200) {
      const detail = getPlanDetail(d, planId);
      const items = day ? (detail?.itemsByDayBySlot[day.id]?.[mealSlot] ?? []) : [];
      const error = !dishName
        ? "Dish name is required"
        : "Dish name must be 200 characters or fewer";

      return c.html(
        <SlotEditorPage
          plan={detail?.plan ?? { id: planId, title: "Plan", start_date: "", end_date: "", status: "draft", target_calories_kcal: null, notes: null }}
          day={day ?? { id: item.meal_plan_day_id, meal_plan_id: planId, plan_date: planDate }}
          slot={mealSlot}
          items={items}
          error={error}
          prefill={{ dish_name: String(body.dish_name ?? ""), notes: String(body.notes ?? "") }}
        />,
        422,
      );
    }

    const updated = runDbMutation(c, () =>
      updateMealPlanItem(d, itemId, { mealSlot, dishName, notes })
    );
    if (isResponse(updated)) return updated;

    return c.redirect(`/plans/${planId}/days/${planDate}/slots/${mealSlot}/edit`, 303);
  });

  app.page("/plans/:planId/items/:itemId/delete", async (c) => {
    if (c.req.method !== "POST") return c.notFound();

    const planId = parsePositiveInt(c.req.param("planId"));
    const itemId = parsePositiveInt(c.req.param("itemId"));
    if (!planId || !itemId) {
      return c.html(<Layout title="Bad Request"><p>Invalid ID</p></Layout>, 400);
    }

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
