import type { OpenAPIApp } from "mock-lib";
import { IngredientTable, Layout, PlanDetailPage } from "../../../components";
import { INGREDIENT_UNITS } from "../../../constants";
import {
  deleteIngredientItem,
  getIngredientItemForPlan,
  getPlanDetail,
  insertIngredientItem,
  updateIngredientItem,
} from "../../../queries";
import {
  isResponse,
  parseBodyOrBadRequest,
  parseNonNegFloat,
  parsePositiveInt,
  runDbMutation,
} from "../../helpers";
import type { RouteDeps } from "../../types";

export function registerIngredientPageRoutes(app: OpenAPIApp, { getDatabase }: RouteDeps) {
  app.page("/plans/:planId/ingredients", async (c) => {
    if (c.req.method !== "POST") return c.notFound();

    const planId = parsePositiveInt(c.req.param("planId"));
    if (!planId) return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);

    const body = await parseBodyOrBadRequest(c);
    if (isResponse(body)) return body;

    const name = String(body.name ?? "").trim();
    const quantityValue = parseNonNegFloat(String(body.quantity_value ?? ""));
    const quantityUnit = String(body.quantity_unit ?? "g");
    const notes = String(body.notes ?? "").trim() || null;

    const d = getDatabase();
    const detail = getPlanDetail(d, planId);
    if (!detail) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

    const renderError = (error: string) =>
      c.html(
        <PlanDetailPage
          plan={detail.plan}
          days={detail.days}
          itemsByDayBySlot={detail.itemsByDayBySlot}
          ingredients={detail.ingredients}
          tab="ingredients"
          ingredientError={error}
          ingredientPrefill={ingredientPrefill(body, quantityUnit)}
        />,
        422,
      );

    const error = validateIngredient(name, quantityValue, quantityUnit);
    if (error) return renderError(error);

    const inserted = runDbMutation(c, () =>
      insertIngredientItem(d, { mealPlanId: planId, name, quantityValue, quantityUnit, notes })
    );
    if (isResponse(inserted)) return inserted;

    return c.redirect(`/plans/${planId}?tab=ingredients`, 303);
  });

  app.page("/plans/:planId/ingredients/:ingId", async (c) => {
    if (c.req.method !== "POST") return c.notFound();

    const planId = parsePositiveInt(c.req.param("planId"));
    const ingId = parsePositiveInt(c.req.param("ingId"));
    if (!planId || !ingId) return c.html(<Layout title="Bad Request"><p>Invalid ID</p></Layout>, 400);

    const d = getDatabase();
    const ing = getIngredientItemForPlan(d, planId, ingId);
    if (!ing) return c.html(<Layout title="Not Found"><p>Ingredient not found</p></Layout>, 404);

    const body = await parseBodyOrBadRequest(c);
    if (isResponse(body)) return body;

    const name = String(body.name ?? "").trim();
    const quantityValue = parseNonNegFloat(String(body.quantity_value ?? ""));
    const quantityUnit = String(body.quantity_unit ?? "g");
    const notes = String(body.notes ?? "").trim() || null;
    const detail = getPlanDetail(d, planId);

    const renderError = (error: string) =>
      c.html(
        detail ? (
          <PlanDetailPage
            plan={detail.plan}
            days={detail.days}
            itemsByDayBySlot={detail.itemsByDayBySlot}
            ingredients={detail.ingredients}
            tab="ingredients"
            ingredientError={error}
            ingredientPrefill={ingredientPrefill(body, quantityUnit)}
          />
        ) : (
          <Layout title="Plan">
            <IngredientTable
              plan={{ id: planId, title: "Plan", start_date: "", end_date: "", status: "draft", target_calories_kcal: null, notes: null }}
              ingredients={[]}
              error={error}
              prefill={ingredientPrefill(body, quantityUnit)}
            />
          </Layout>
        ),
        422,
      );

    const error = validateIngredient(name, quantityValue, quantityUnit);
    if (error) return renderError(error);

    const updated = runDbMutation(c, () =>
      updateIngredientItem(d, ingId, { name, quantityValue, quantityUnit, notes })
    );
    if (isResponse(updated)) return updated;

    return c.redirect(`/plans/${planId}?tab=ingredients`, 303);
  });

  app.page("/plans/:planId/ingredients/:ingId/delete", async (c) => {
    if (c.req.method !== "POST") return c.notFound();

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

function ingredientPrefill(body: Record<string, unknown>, quantityUnit: string) {
  return {
    name: String(body.name ?? ""),
    quantity_value: String(body.quantity_value ?? ""),
    quantity_unit: quantityUnit,
  };
}

function validateIngredient(
  name: string,
  quantityValue: number | null,
  quantityUnit: string,
) {
  if (!name) return "Ingredient name is required";
  if (name.length > 200) return "Ingredient name must be 200 characters or fewer";
  if (quantityValue === null || quantityValue < 0) return "Invalid quantity value";
  if (!(INGREDIENT_UNITS as readonly string[]).includes(quantityUnit)) return "Invalid unit";
  return null;
}
