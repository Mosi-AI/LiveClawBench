import type { OpenAPIApp } from "mock-lib";
import { Layout } from "../../../components";
import { todayLocal } from "../../../date";
import {
  ensureDailyLog,
  getFoodEntry,
  insertFoodEntry,
  isValidLocalDate,
  updateFoodEntry,
} from "../../../queries";
import {
  isMealSlot,
  isResponse,
  parseBodyOrBadRequest,
  parsePositiveInt,
  runDbMutation,
} from "../../helpers";
import type { RouteDeps } from "../../types";
import {
  parseExistingEntryForm,
  parseNewEntryForm,
  toEntryInput,
  toEntryUpdateInput,
} from "./entry-form";

export function registerLogEntryMutationRoutes(
  app: OpenAPIApp,
  { getDatabase }: RouteDeps,
) {
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

    const d = getDatabase();
    const parsed = parseNewEntryForm(d, body as Record<string, unknown>);
    if ("error" in parsed) {
      return c.redirect(
        `/log/${date}/add/${mealSlot}?error=${encodeURIComponent(parsed.error)}`,
        303,
      );
    }

    const log = runDbMutation(c, () => ensureDailyLog(d, date));
    if (isResponse(log)) return log;

    const inserted = runDbMutation(c, () =>
      insertFoodEntry(d, toEntryInput(parsed.values, log.id, mealSlot))
    );
    if (isResponse(inserted)) return inserted;

    return c.redirect(`/log/${date}`, 303);
  });

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

    const body = await parseBodyOrBadRequest(c);
    if (isResponse(body)) return body;

    const parsed = parseExistingEntryForm(d, body as Record<string, unknown>, entry);
    if ("error" in parsed) {
      return c.redirect(
        `/log/entry/${entryId}/edit?error=${encodeURIComponent(parsed.error)}`,
        303,
      );
    }

    const updated = runDbMutation(c, () =>
      updateFoodEntry(d, entryId, toEntryUpdateInput(parsed.values))
    );
    if (isResponse(updated)) return updated;

    return c.redirect(`/log/${date}`, 303);
  });
}
