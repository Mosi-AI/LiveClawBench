import { CATALOG_MISSING_ERROR, LOG_SLOTS } from "../constants";
import { Layout, DayNav, EntryForm, MealSlotCard, SummaryPanel } from "../components";
import { todayLocal } from "../date";
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
  searchFoodCatalog,
  updateFoodEntry,
} from "../queries";
import type { FoodCatalog, MealSlot } from "../queries";
import {
  isMealSlot,
  isResponse,
  parseBodyOrBadRequest,
  parseNonNegFloat,
  parsePositiveInt,
  runDbMutation,
} from "./helpers";
import type { MintDietApp, RouteDeps } from "./types";

export interface ManualMacroValues {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const MANUAL_MACRO_FIELDS = [
  ["calories_kcal", "calories", "caloriesKcal"],
  ["protein_g", "protein", "proteinG"],
  ["carbs_g", "carbs", "carbsG"],
  ["fat_g", "fat", "fatG"],
] as const;

export function isCatalogQuantityUnit(catalog: FoodCatalog, quantityUnit: string): boolean {
  return quantityUnit === catalog.serving_size_unit || quantityUnit === "份";
}

export function parseManualMacros(body: Record<string, unknown>): { values: ManualMacroValues } | { error: string } {
  const values: ManualMacroValues = { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

  for (const [bodyKey, label, valueKey] of MANUAL_MACRO_FIELDS) {
    const raw = String(body[bodyKey] ?? "").trim();
    if (!raw) continue;

    const value = parseNonNegFloat(raw);
    if (value === null) return { error: `Invalid ${label} value` };
    values[valueKey] = value;
  }

  return { values };
}

export function registerLogRoutes(app: MintDietApp, { getDatabase }: RouteDeps) {
  app.get("/log", (c) => c.redirect(`/log/${todayLocal()}`, 302));

  app.get("/log/:date", async (c) => {
    const { date } = c.req.param();
    if (!isValidLocalDate(date)) return c.html(<Layout title="Bad Request"><p>Invalid date: {date}</p></Layout>, 400);

    const d = getDatabase();
    const log = runDbMutation(c, () => ensureDailyLog(d, date));
    if (isResponse(log)) return log;
    const entries = listEntriesByDay(d, log.id);
    const totals = computeDailyTotals(d, log.id);
    const budget = resolveEffectiveBudget(d, date);

    const bySlot: Record<MealSlot, typeof entries> = { breakfast: [], lunch: [], dinner: [], snacks: [] };
    for (const e of entries) bySlot[e.meal_slot].push(e);

    return c.html(
      <Layout title={date}>
        <DayNav date={date} />
        <SummaryPanel totals={totals} budget={budget} />
        {LOG_SLOTS.map(slot => (
          <MealSlotCard key={slot} slot={slot} entries={bySlot[slot]} date={date} />
        ))}
      </Layout>
    );
  });

  app.get("/log/:date/add/:slot", async (c) => {
    const { date, slot } = c.req.param();
    if (!isValidLocalDate(date)) return c.html(<Layout title="Bad Request"><p>Invalid date</p></Layout>, 400);
    if (!isMealSlot(slot)) return c.html(<Layout title="Bad Request"><p>Invalid slot</p></Layout>, 400);

    const q = c.req.query("q");
    const foodId = c.req.query("food");
    const d = getDatabase();

    let food: FoodCatalog | null = null;
    let searchResults: FoodCatalog[] | undefined;

    if (foodId) {
      const id = parsePositiveInt(foodId);
      if (id) food = getFoodById(d, id);
    } else if (q !== undefined) {
      searchResults = searchFoodCatalog(d, q);
    }

    return c.html(<EntryForm date={date} slot={slot} food={food} searchResults={searchResults} query={q} />);
  });

  app.post("/log/:date/entries", async (c) => {
    const { date } = c.req.param();
    if (!isValidLocalDate(date)) return c.html(<Layout title="Bad Request"><p>Invalid date</p></Layout>, 400);

    const body = await parseBodyOrBadRequest(c);
    if (isResponse(body)) return body;
    const mealSlot = String(body.slot ?? "");
    if (!isMealSlot(mealSlot)) {
      return c.html(<Layout title="Bad Request"><p>Invalid slot</p></Layout>, 400);
    }

    const foodCatalogIdRaw = body.food_catalog_id ? String(body.food_catalog_id) : null;
    const foodCatalogId = foodCatalogIdRaw ? parsePositiveInt(foodCatalogIdRaw) : null;
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

    if (!foodName) return c.html(
      <EntryForm date={date} slot={mealSlot} error="Food name is required" prefill={makePrefill()} />, 422
    );
    if (foodName.length > 200) return c.html(
      <EntryForm date={date} slot={mealSlot} error="Food name must be 200 characters or fewer" prefill={makePrefill()} />, 422
    );
    if (quantityValue === null || quantityValue < 0) return c.html(
      <EntryForm date={date} slot={mealSlot} error="Invalid quantity" prefill={makePrefill()} />, 422
    );
    if (foodCatalogIdRaw && !foodCatalogId) return c.html(
      <EntryForm date={date} slot={mealSlot} error="Invalid selected food" prefill={makePrefill()} />, 422
    );

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
      const macros = parseManualMacros(body as Record<string, unknown>);
      if ("error" in macros) {
        return c.html(<EntryForm date={date} slot={mealSlot} error={macros.error} prefill={makePrefill()} />, 422);
      }
      caloriesKcal = macros.values.caloriesKcal;
      proteinG = macros.values.proteinG;
      carbsG = macros.values.carbsG;
      fatG = macros.values.fatG;
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

  app.get("/log/entry/:entryId/edit", async (c) => {
    const entryId = parsePositiveInt(c.req.param("entryId"));
    if (!entryId) return c.html(<Layout title="Bad Request"><p>Invalid entry ID</p></Layout>, 400);

    const d = getDatabase();
    const entry = getFoodEntry(d, entryId);
    if (!entry) return c.html(<Layout title="Not Found"><p>Entry not found</p></Layout>, 404);

    const log = d.query("SELECT log_date FROM daily_log WHERE id = ?").get(entry.daily_log_id) as { log_date: string } | null;
    const date = log?.log_date ?? todayLocal();

    let food: FoodCatalog | null = null;
    if (entry.food_catalog_id) food = getFoodById(d, entry.food_catalog_id);

    return c.html(<EntryForm date={date} slot={entry.meal_slot} food={food} entry={entry} />);
  });

  app.post("/log/entries/:entryId", async (c) => {
    const entryId = parsePositiveInt(c.req.param("entryId"));
    if (!entryId) return c.html(<Layout title="Bad Request"><p>Invalid entry ID</p></Layout>, 400);

    const d = getDatabase();
    const entry = getFoodEntry(d, entryId);
    if (!entry) return c.html(<Layout title="Not Found"><p>Entry not found</p></Layout>, 404);

    const log = d.query("SELECT log_date FROM daily_log WHERE id = ?").get(entry.daily_log_id) as { log_date: string } | null;
    const date = log?.log_date ?? todayLocal();

    let food: FoodCatalog | null = null;
    if (entry.food_catalog_id) food = getFoodById(d, entry.food_catalog_id);

    const body = await parseBodyOrBadRequest(c);
    if (isResponse(body)) return body;
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

    if (!foodName) return c.html(
      <EntryForm date={date} slot={entry.meal_slot} food={food} entry={entry} error="Food name is required" prefill={makePrefill()} />, 422
    );
    if (foodName.length > 200) return c.html(
      <EntryForm date={date} slot={entry.meal_slot} food={food} entry={entry} error="Food name must be 200 characters or fewer" prefill={makePrefill()} />, 422
    );
    if (quantityValue === null || quantityValue < 0) return c.html(
      <EntryForm date={date} slot={entry.meal_slot} food={food} entry={entry} error="Invalid quantity" prefill={makePrefill()} />, 422
    );

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
      const macros = parseManualMacros(body as Record<string, unknown>);
      if ("error" in macros) {
        return c.html(<EntryForm date={date} slot={entry.meal_slot} food={food} entry={entry} error={macros.error} prefill={makePrefill()} />, 422);
      }
      caloriesKcal = macros.values.caloriesKcal;
      proteinG = macros.values.proteinG;
      carbsG = macros.values.carbsG;
      fatG = macros.values.fatG;
    }

    if (caloriesKcal > 100000) return c.html(
      <EntryForm date={date} slot={entry.meal_slot} food={food} entry={entry} error="Calories value too large (max 100000)" prefill={makePrefill()} />, 422
    );

    const updated = runDbMutation(c, () => updateFoodEntry(d, entryId, { foodName, quantityValue, quantityUnit, caloriesKcal, proteinG, carbsG, fatG }));
    if (isResponse(updated)) return updated;
    return c.redirect(`/log/${date}`, 303);
  });

  app.post("/log/entries/:entryId/delete", async (c) => {
    const entryId = parsePositiveInt(c.req.param("entryId"));
    if (!entryId) return c.html(<Layout title="Bad Request"><p>Invalid entry ID</p></Layout>, 400);

    const d = getDatabase();
    const entry = getFoodEntry(d, entryId);
    if (!entry) return c.html(<Layout title="Not Found"><p>Entry not found</p></Layout>, 404);

    const log = d.query("SELECT log_date FROM daily_log WHERE id = ?").get(entry.daily_log_id) as { log_date: string } | null;
    const date = log?.log_date ?? todayLocal();

    const deleted = runDbMutation(c, () => deleteFoodEntry(d, entryId));
    if (isResponse(deleted)) return deleted;
    return c.redirect(`/log/${date}`, 303);
  });
}
