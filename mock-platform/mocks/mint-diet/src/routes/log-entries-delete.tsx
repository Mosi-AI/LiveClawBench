/** @jsxImportSource hono/jsx */
import { createRoute } from "mock-lib";
import { Layout } from "../components";
import { todayLocal } from "../date";
import {
  deleteFoodEntry,
  getFoodEntry,
} from "../queries";
import { isResponse, runDbMutation } from "./helpers";
import {
  EntryIdParamSchema,
  RedirectResponse,
  HtmlResponse,
} from "./schemas";
import type { MintDietApp, RouteDeps } from "./types";

export function registerLogEntryDeleteRoutes(app: MintDietApp, { getDatabase }: RouteDeps) {
  const deleteFoodEntryRoute = createRoute({
    method: "post",
    path: "/log/entries/{entryId}/delete",
    summary: "Delete a food log entry",
    request: {
      params: EntryIdParamSchema,
    },
    responses: {
      303: RedirectResponse,
      404: HtmlResponse,
      500: HtmlResponse,
    },
  });

  app.openApiRoute(deleteFoodEntryRoute, async (c) => {
    const { entryId } = c.req.valid("param");
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
