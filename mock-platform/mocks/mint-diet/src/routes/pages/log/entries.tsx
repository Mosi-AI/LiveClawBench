import type { OpenAPIApp } from "mock-lib";
import {
  Layout,
  DayNav,
  MealSlotCard,
  SummaryPanel,
} from "../../../components";
import { todayLocal } from "../../../date";
import {
  computeDailyTotals,
  deleteFoodEntry,
  ensureDailyLog,
  getFoodById,
  getFoodEntry,
  insertFoodEntry,
  isValidLocalDate,
  listEntriesByDay,
  resolveEffectiveBudget,
  scaleMacros,
  updateFoodEntry,
} from "../../../queries";
import type { FoodCatalog, MealSlot } from "../../../queries";
import { CATALOG_MISSING_ERROR } from "../../../constants";
import {
  isCatalogQuantityUnit,
  parseManualMacros,
} from "../../log-shared";
import {
  isMealSlot,
  isResponse,
  parseNonNegFloat,
  parsePositiveInt,
  runDbMutation,
  parseBodyOrBadRequest,
} from "../../helpers";
import type { RouteDeps } from "../../types";

export function registerLogEntryRoutes(app: OpenAPIApp, { getDatabase }: RouteDeps) {
  // GET /log - Redirect to today
  app.page("/log", (c) => c.redirect(`/log/${todayLocal()}`, 302));

  // GET /log/:date - Daily log view
  app.page("/log/:date", async (c) => {
    const { date } = c.req.param();
    if (!isValidLocalDate(date)) {
      return c.html(<Layout title="Bad Request"><p>Invalid date: {date}</p></Layout>, 400);
    }

    const d = getDatabase();
    const log = runDbMutation(c, () => ensureDailyLog(d, date));
    if (isResponse(log)) return log;

    const entries = listEntriesByDay(d, log.id);
    const totals = computeDailyTotals(d, log.id);
    const budget = resolveEffectiveBudget(d, date);

    const bySlot: Record<MealSlot, typeof entries> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: [],
    };
    for (const e of entries) bySlot[e.meal_slot].push(e);

    return c.html(
      <Layout title={date}>
        <DayNav date={date} />
        <SummaryPanel totals={totals} budget={budget} />
        {(["breakfast", "lunch", "dinner", "snacks"] as const).map((slot) => (
          <MealSlotCard key={slot} slot={slot} entries={bySlot[slot]} date={date} />
        ))}
      </Layout>
    );
  });

  // POST /log/:date/entries - Create entry
  app.page("/log/:date/entries", async (c) => {
    if (c.req.method !== "POST") return c.notFound();

    const { date } = c.req.param();
    if (!isValidLocalDate(date)) {
      return c.html(<Layout title="Bad Request"><p>Invalid date</p></Layout>, 400);
    }

    const body = await parseBodyOrBadRequest(c);
    if (isResponse(body)) return body;

    const mealSlot = String(body.slot ?? "");
    if (!isMealSlot(mealSlot)) {
      return c.html(<Layout title="Bad Request"><p>Invalid slot</p></Layout>, 400);
    }

    const foodCatalogIdRaw = body.food_catalog_id
      ? String(body.food_catalog_id)
      : null;
    const foodCatalogId = foodCatalogIdRaw
      ? parsePositiveInt(foodCatalogIdRaw)
      : null;
    const foodName = String(body.food_name ?? "").trim();
    const quantityValue = parseNonNegFloat(String(body.quantity_value ?? ""));
    const quantityUnit = String(body.quantity_unit ?? "");

    const makePrefill = () => ({
      food_name: String(body.food_name ?? ""),
      quantity_value: String(body.quantity_value ?? ""),
      quantity_unit: quantityUnit,
      calories_kcal: String(body.calories_kcal ?? "0"),
      protein_g: String(body.protein_g ?? "0"),
      carbs_g: String(body.carbs_g ?? "0"),
      fat_g: String(body.fat_g ?? "0"),
    });

    // Validation
    if (!foodName) {
      return c.redirect(`/log/${date}/add/${mealSlot}?error=${encodeURIComponent("Food name is required")}`, 303);
    }
    if (foodName.length > 200) {
      return c.redirect(`/log/${date}/add/${mealSlot}?error=${encodeURIComponent("Food name must be 200 characters or fewer")}`, 303);
    }
    if (quantityValue === null || quantityValue < 0) {
      return c.redirect(`/log/${date}/add/${mealSlot}?error=${encodeURIComponent("Invalid quantity")}`, 303);
    }
    if (foodCatalogIdRaw && !foodCatalogId) {
      return c.redirect(`/log/${date}/add/${mealSlot}?error=${encodeURIComponent("Invalid selected food")}`, 303);
    }

    const d = getDatabase();
    let caloriesKcal = 0,
      proteinG = 0,
      carbsG = 0,
      fatG = 0;

    if (foodCatalogId) {
      const catalog = getFoodById(d, foodCatalogId);
      if (!catalog) {
        return c.redirect(`/log/${date}/add/${mealSlot}?error=${encodeURIComponent(CATALOG_MISSING_ERROR)}`, 303);
      }
      if (!isCatalogQuantityUnit(catalog, quantityUnit)) {
        return c.redirect(`/log/${date}/add/${mealSlot}?error=${encodeURIComponent("Invalid quantity unit for selected food")}`, 303);
      }
      try {
        const macros = scaleMacros(catalog, quantityValue, quantityUnit);
        caloriesKcal = macros.calories;
        proteinG = macros.protein;
        carbsG = macros.carbs;
        fatG = macros.fat;
      } catch (err) {
        console.error("Failed to scale catalog macros", err);
        return c.redirect(`/log/${date}/add/${mealSlot}?error=${encodeURIComponent("Selected food has invalid catalog nutrition data")}`, 303);
      }
    } else {
      const macros = parseManualMacros(body as Record<string, unknown>);
      if ("error" in macros) {
        return c.redirect(`/log/${date}/add/${mealSlot}?error=${encodeURIComponent(macros.error)}`, 303);
      }
      caloriesKcal = macros.values.caloriesKcal;
      proteinG = macros.values.proteinG;
      carbsG = macros.values.carbsG;
      fatG = macros.values.fatG;
    }

    if (caloriesKcal > 100000) {
      return c.redirect(`/log/${date}/add/${mealSlot}?error=${encodeURIComponent("Calories value too large (max 100000)")}`, 303);
    }

    const log = runDbMutation(c, () => ensureDailyLog(d, date));
    if (isResponse(log)) return log;

    const inserted = runDbMutation(c, () =>
      insertFoodEntry(d, {
        dailyLogId: log.id,
        foodCatalogId,
        mealSlot,
        foodName,
        quantityValue,
        quantityUnit,
        caloriesKcal,
        proteinG,
        carbsG,
        fatG,
      })
    );
    if (isResponse(inserted)) return inserted;

    return c.redirect(`/log/${date}`, 303);
  });

  // POST /log/entries/:entryId - Update entry
  app.page("/log/entries/:entryId", async (c) => {
    if (c.req.method !== "POST") return c.notFound();

    const entryId = parsePositiveInt(c.req.param("entryId"));
    if (!entryId) {
      return c.html(<Layout title="Bad Request"><p>Invalid entry ID</p></Layout>, 400);
    }

    const d = getDatabase();
    const entry = getFoodEntry(d, entryId);
    if (!entry) {
      return c.html(<Layout title="Not Found"><p>Entry not found</p></Layout>, 404);
    }

    const log = d
      .query("SELECT log_date FROM daily_log WHERE id = ?")
      .get(entry.daily_log_id) as { log_date: string } | null;
    const date = log?.log_date ?? todayLocal();

    let food: FoodCatalog | null = null;
    if (entry.food_catalog_id) food = getFoodById(d, entry.food_catalog_id);

    const body = await parseBodyOrBadRequest(c);
    if (isResponse(body)) return body;

    const foodName = String(body.food_name ?? "").trim();
    const quantityValue = parseNonNegFloat(String(body.quantity_value ?? ""));
    const quantityUnit = String(body.quantity_unit ?? "");

    // Validation
    if (!foodName) {
      return c.redirect(`/log/entry/${entryId}/edit?error=${encodeURIComponent("Food name is required")}`, 303);
    }
    if (foodName.length > 200) {
      return c.redirect(`/log/entry/${entryId}/edit?error=${encodeURIComponent("Food name must be 200 characters or fewer")}`, 303);
    }
    if (quantityValue === null || quantityValue < 0) {
      return c.redirect(`/log/entry/${entryId}/edit?error=${encodeURIComponent("Invalid quantity")}`, 303);
    }

    let caloriesKcal = entry.calories_kcal,
      proteinG = entry.protein_g,
      carbsG = entry.carbs_g,
      fatG = entry.fat_g;

    if (entry.food_catalog_id) {
      const catalog = getFoodById(d, entry.food_catalog_id);
      if (!catalog) {
        return c.redirect(`/log/entry/${entryId}/edit?error=${encodeURIComponent(CATALOG_MISSING_ERROR)}`, 303);
      }
      if (!isCatalogQuantityUnit(catalog, quantityUnit)) {
        return c.redirect(`/log/entry/${entryId}/edit?error=${encodeURIComponent("Invalid quantity unit for selected food")}`, 303);
      }
      try {
        const macros = scaleMacros(catalog, quantityValue, quantityUnit);
        caloriesKcal = macros.calories;
        proteinG = macros.protein;
        carbsG = macros.carbs;
        fatG = macros.fat;
      } catch (err) {
        console.error("Failed to scale catalog macros", err);
        return c.redirect(`/log/entry/${entryId}/edit?error=${encodeURIComponent("Selected food has invalid catalog nutrition data")}`, 303);
      }
    } else {
      const macros = parseManualMacros(body as Record<string, unknown>);
      if ("error" in macros) {
        return c.redirect(`/log/entry/${entryId}/edit?error=${encodeURIComponent(macros.error)}`, 303);
      }
      caloriesKcal = macros.values.caloriesKcal;
      proteinG = macros.values.proteinG;
      carbsG = macros.values.carbsG;
      fatG = macros.values.fatG;
    }

    if (caloriesKcal > 100000) {
      return c.redirect(`/log/entry/${entryId}/edit?error=${encodeURIComponent("Calories value too large (max 100000)")}`, 303);
    }

    const updated = runDbMutation(c, () =>
      updateFoodEntry(d, entryId, {
        foodName,
        quantityValue,
        quantityUnit,
        caloriesKcal,
        proteinG,
        carbsG,
        fatG,
      })
    );
    if (isResponse(updated)) return updated;

    return c.redirect(`/log/${date}`, 303);
  });

  // POST /log/entries/:entryId/delete - Delete entry
  app.page("/log/entries/:entryId/delete", async (c) => {
    if (c.req.method !== "POST") return c.notFound();

    const entryId = parsePositiveInt(c.req.param("entryId"));
    if (!entryId) {
      return c.html(<Layout title="Bad Request"><p>Invalid entry ID</p></Layout>, 400);
    }

    const d = getDatabase();
    const entry = getFoodEntry(d, entryId);
    if (!entry) {
      return c.html(<Layout title="Not Found"><p>Entry not found</p></Layout>, 404);
    }

    const log = d
      .query("SELECT log_date FROM daily_log WHERE id = ?")
      .get(entry.daily_log_id) as { log_date: string } | null;
    const date = log?.log_date ?? todayLocal();

    const deleted = runDbMutation(c, () => deleteFoodEntry(d, entryId));
    if (isResponse(deleted)) return deleted;

    return c.redirect(`/log/${date}`, 303);
  });
}
