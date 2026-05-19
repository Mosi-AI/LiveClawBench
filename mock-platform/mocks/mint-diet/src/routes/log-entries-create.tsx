/** @jsxImportSource hono/jsx */
import { createRoute } from "mock-lib";
import { CATALOG_MISSING_ERROR } from "./log-shared";
import { EntryForm } from "../components";
import {
  ensureDailyLog,
  getFoodById,
  insertFoodEntry,
  scaleMacros,
} from "../queries";
import { isResponse, runDbMutation } from "./helpers";
import { isCatalogQuantityUnit } from "./log-shared";
import {
  CreateFoodEntryFormSchema,
  LogDateParamSchema,
  RedirectResponse,
  HtmlResponse,
} from "./schemas";
import type { MintDietApp, RouteDeps } from "./types";

export function registerLogEntryCreateRoutes(app: MintDietApp, { getDatabase }: RouteDeps) {
  const createFoodEntryRoute = createRoute({
    method: "post",
    path: "/log/{date}/entries",
    summary: "Create a food log entry",
    request: {
      params: LogDateParamSchema,
      body: {
        required: true,
        content: {
          "application/x-www-form-urlencoded": {
            schema: CreateFoodEntryFormSchema,
          },
        },
      },
    },
    responses: {
      303: RedirectResponse,
      422: HtmlResponse,
      500: HtmlResponse,
    },
  });

  app.openApiRoute(createFoodEntryRoute, async (c) => {
    const { date } = c.req.valid("param");
    const body = c.req.valid("form");
    const mealSlot = body.slot;
    const foodCatalogId = body.food_catalog_id;
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

    let caloriesKcal = 0, proteinG = 0, carbsG = 0, fatG = 0;

    if (foodCatalogId) {
      const d = getDatabase();
      const catalog = getFoodById(d, foodCatalogId);
      if (!catalog) {
        return c.html(<EntryForm date={date} slot={mealSlot} error={CATALOG_MISSING_ERROR} prefill={makePrefill()} />, 422);
      }
      if (!isCatalogQuantityUnit(catalog, quantityUnit)) {
        return c.html(<EntryForm date={date} slot={mealSlot} food={catalog} error="Invalid quantity unit for selected food" prefill={makePrefill()} />, 422);
      }
      try {
        const macros = scaleMacros(catalog, quantityValue, quantityUnit);
        caloriesKcal = macros.calories;
        proteinG = macros.protein;
        carbsG = macros.carbs;
        fatG = macros.fat;
      } catch (err) {
        console.error("Failed to scale catalog macros", err);
        return c.html(<EntryForm date={date} slot={mealSlot} error="Selected food has invalid catalog nutrition data" prefill={makePrefill()} />, 422);
      }
    } else {
      caloriesKcal = body.calories_kcal;
      proteinG = body.protein_g;
      carbsG = body.carbs_g;
      fatG = body.fat_g;
    }

    if (caloriesKcal > 100000) return c.html(
      <EntryForm date={date} slot={mealSlot} error="Calories value too large (max 100000)" prefill={makePrefill()} />, 422
    );

    const d = getDatabase();
    const log = runDbMutation(c, () => ensureDailyLog(d, date));
    if (isResponse(log)) return log;
    const inserted = runDbMutation(c, () => insertFoodEntry(d, { dailyLogId: log.id, foodCatalogId, mealSlot, foodName, quantityValue, quantityUnit, caloriesKcal, proteinG, carbsG, fatG }));
    if (isResponse(inserted)) return inserted;
    return c.redirect(`/log/${date}`, 303);
  });
}
