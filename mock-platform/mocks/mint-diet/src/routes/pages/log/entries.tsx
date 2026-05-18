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
  getFoodEntry,
  isValidLocalDate,
  listEntriesByDay,
  resolveEffectiveBudget,
} from "../../../queries";
import type { MealSlot } from "../../../queries";
import {
  isResponse,
  parsePositiveInt,
  runDbMutation,
} from "../../helpers";
import type { RouteDeps } from "../../types";
import { registerLogEntryMutationRoutes } from "./entry-mutations";

export function registerLogEntryRoutes(app: OpenAPIApp, { getDatabase }: RouteDeps) {
  registerLogEntryMutationRoutes(app, { getDatabase });

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
