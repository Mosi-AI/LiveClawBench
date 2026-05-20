import type { OpenAPIApp } from "mock-lib";
import {
  Layout,
  SlotEditorPage,
} from "../../../components";
import {
  isValidLocalDate,
  getPlanDetail,
  getDayByPlanAndDate,
} from "../../../queries";
import {
  isPlanMealSlot,
  parsePositiveInt,
} from "../../helpers";
import type { RouteDeps } from "../../types";
import { registerIngredientPageRoutes } from "./ingredient-items";
import { registerPlanItemPageRoutes } from "./meal-items";

export function registerPlanMealsRoutes(app: OpenAPIApp, { getDatabase }: RouteDeps) {
  registerPlanItemPageRoutes(app, { getDatabase });
  registerIngredientPageRoutes(app, { getDatabase });

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

}
