/** @jsxImportSource hono/jsx */
import { createRoute } from "mock-lib";
import { CATALOG_MISSING_ERROR } from "./log-shared";
import { Layout, EntryForm } from "../components";
import { todayLocal } from "../date";
import {
  getFoodById,
  getFoodEntry,
  scaleMacros,
  updateFoodEntry,
} from "../queries";
import type { FoodCatalog } from "../queries";
import { isResponse, runDbMutation } from "./helpers";
import { isCatalogQuantityUnit } from "./log-shared";
import {
  EntryIdParamSchema,
  RedirectResponse,
  HtmlResponse,
  UpdateFoodEntryFormSchema,
} from "./schemas";
import type { MintDietApp, RouteDeps } from "./types";

export function registerLogEntryUpdateRoutes(app: MintDietApp, { getDatabase }: RouteDeps) {
  const updateFoodEntryRoute = createRoute({
    method: "post",
    path: "/log/entries/{entryId}",
    summary: "Update a food log entry",
    request: {
      params: EntryIdParamSchema,
      body: {
        required: true,
        content: {
          "application/x-www-form-urlencoded": {
            schema: UpdateFoodEntryFormSchema,
          },
        },
      },
    },
    responses: {
      303: RedirectResponse,
      404: HtmlResponse,
      422: HtmlResponse,
      500: HtmlResponse,
    },
  });

  app.openApiRoute(updateFoodEntryRoute, async (c) => {
    const { entryId } = c.req.valid("param");
    const d = getDatabase();
    const entry = getFoodEntry(d, entryId);
    if (!entry) return c.html(<Layout title="Not Found"><p>Entry not found</p></Layout>, 404);

    const log = d.query("SELECT log_date FROM daily_log WHERE id = ?").get(entry.daily_log_id) as { log_date: string } | null;
    const date = log?.log_date ?? todayLocal();

    let food: FoodCatalog | null = null;
    if (entry.food_catalog_id) food = getFoodById(d, entry.food_catalog_id);

    const body = c.req.valid("form");
    const foodName = body.food_name;
    const quantityValue = body.quantity_value;
    const quantityUnit = body.quantity_unit;

    const makePrefill = () => ({
      food_name: body.food_name,
      quantity_value: String(body.quantity_value),
      quantity_unit: quantityUnit,
      calories_kcal: String(body.calories_kcal),
      protein_g: String(body.protein_g),
      carbs_g: String(body.carbs_g),
      fat_g: String(body.fat_g),
    });

    let caloriesKcal = entry.calories_kcal, proteinG = entry.protein_g, carbsG = entry.carbs_g, fatG = entry.fat_g;

    if (entry.food_catalog_id) {
      const catalog = getFoodById(d, entry.food_catalog_id);
      if (!catalog) {
        return c.html(<EntryForm date={date} slot={entry.meal_slot} food={food} entry={entry} error={CATALOG_MISSING_ERROR} prefill={makePrefill()} />, 422);
      }
      if (!isCatalogQuantityUnit(catalog, quantityUnit)) {
        return c.html(<EntryForm date={date} slot={entry.meal_slot} food={catalog} entry={entry} error="Invalid quantity unit for selected food" prefill={makePrefill()} />, 422);
      }
      try {
        const macros = scaleMacros(catalog, quantityValue, quantityUnit);
        caloriesKcal = macros.calories;
        proteinG = macros.protein;
        carbsG = macros.carbs;
        fatG = macros.fat;
      } catch (err) {
        console.error("Failed to scale catalog macros", err);
        return c.html(<EntryForm date={date} slot={entry.meal_slot} food={food} entry={entry} error="Selected food has invalid catalog nutrition data" prefill={makePrefill()} />, 422);
      }
    } else {
      caloriesKcal = body.calories_kcal;
      proteinG = body.protein_g;
      carbsG = body.carbs_g;
      fatG = body.fat_g;
    }

    if (caloriesKcal > 100000) return c.html(
      <EntryForm date={date} slot={entry.meal_slot} food={food} entry={entry} error="Calories value too large (max 100000)" prefill={makePrefill()} />, 422
    );

    const updated = runDbMutation(c, () => updateFoodEntry(d, entryId, { foodName, quantityValue, quantityUnit, caloriesKcal, proteinG, carbsG, fatG }));
    if (isResponse(updated)) return updated;
    return c.redirect(`/log/${date}`, 303);
  });
}
