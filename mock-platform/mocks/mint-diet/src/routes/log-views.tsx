/** @jsxImportSource hono/jsx */
import { CATALOG_MISSING_ERROR } from "../constants";
import { Layout, DayNav, EntryForm, MealSlotCard, SummaryPanel } from "../components";
import { todayLocal } from "../date";
import {
  computeDailyTotals,
  ensureDailyLog,
  getFoodById,
  isValidLocalDate,
  listEntriesByDay,
  resolveEffectiveBudget,
  searchFoodCatalog,
} from "../queries";
import type { FoodCatalog, MealSlot } from "../queries";
import { isMealSlot, isResponse, parsePositiveInt, runDbMutation } from "./helpers";
import type { MintDietApp, RouteDeps } from "./types";

export function registerLogViewRoutes(app: MintDietApp, { getDatabase }: RouteDeps) {
  app.page("/log", (c) => c.redirect(`/log/${todayLocal()}`, 302));

  app.page("/log/:date", async (c) => {
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
        {(["breakfast", "lunch", "dinner", "snacks"] as MealSlot[]).map(slot => (
          <MealSlotCard key={slot} slot={slot} entries={bySlot[slot]} date={date} />
        ))}
      </Layout>
    );
  });

  app.page("/log/:date/add/:slot", async (c) => {
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

  app.page("/log/entry/:entryId/edit", async (c) => {
    const entryId = parsePositiveInt(c.req.param("entryId"));
    if (!entryId) return c.html(<Layout title="Bad Request"><p>Invalid entry ID</p></Layout>, 400);

    const d = getDatabase();
    const { getFoodEntry } = await import("../queries");
    const entry = getFoodEntry(d, entryId);
    if (!entry) return c.html(<Layout title="Not Found"><p>Entry not found</p></Layout>, 404);

    const log = d.query("SELECT log_date FROM daily_log WHERE id = ?").get(entry.daily_log_id) as { log_date: string } | null;
    const date = log?.log_date ?? todayLocal();

    let food: FoodCatalog | null = null;
    if (entry.food_catalog_id) food = getFoodById(d, entry.food_catalog_id);

    return c.html(<EntryForm date={date} slot={entry.meal_slot} food={food} entry={entry} />);
  });
}

// Re-export helper used by log-entries
export { CATALOG_MISSING_ERROR };
