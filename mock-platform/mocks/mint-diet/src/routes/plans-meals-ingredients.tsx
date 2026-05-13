/** @jsxImportSource hono/jsx */
import { createRoute } from "mock-lib";
import { Layout } from "../components";
import {
  deleteIngredientItem,
  getIngredientItemForPlan,
  getPlanDetail,
  insertIngredientItem,
  updateIngredientItem,
} from "../queries";
import { isResponse, runDbMutation } from "./helpers";
import {
  HtmlResponse,
  IngredientFormSchema,
  PlanIdParamSchema,
  PlanIngredientParamSchema,
  RedirectResponse,
  formRequest,
} from "./schemas";
import type { MintDietApp, RouteDeps } from "./types";

export function registerPlanMealIngredientRoutes(app: MintDietApp, { getDatabase }: RouteDeps) {
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
