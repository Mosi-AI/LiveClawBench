import type { OpenAPIApp } from "mock-lib";
import { Layout, EntryForm } from "../../../components";
import {
  getFoodById,
  searchFoodCatalog,
  isValidLocalDate,
  getFoodEntry,
} from "../../../queries";
import type { FoodCatalog } from "../../../queries";
import {
  isMealSlot,
  parsePositiveInt,
} from "../../helpers";
import type { RouteDeps } from "../../types";

export function registerLogViewRoutes(app: OpenAPIApp, { getDatabase }: RouteDeps) {
  // GET /log/:date/add/:slot - Entry form
  app.page("/log/:date/add/:slot", async (c) => {
    const { date, slot } = c.req.param();
    if (!isValidLocalDate(date)) {
      return c.html(<Layout title="Bad Request"><p>Invalid date</p></Layout>, 400);
    }
    if (!isMealSlot(slot)) {
      return c.html(<Layout title="Bad Request"><p>Invalid slot</p></Layout>, 400);
    }

    const q = c.req.query("q");
    const foodId = c.req.query("food");
    const error = c.req.query("error");
    const d = getDatabase();

    let food: FoodCatalog | null = null;
    let searchResults: FoodCatalog[] | undefined;

    if (foodId) {
      const id = parsePositiveInt(foodId);
      if (id) food = getFoodById(d, id);
    } else if (q !== undefined) {
      searchResults = searchFoodCatalog(d, q);
    }

    return c.html(
      <EntryForm
        date={date}
        slot={slot}
        food={food}
        searchResults={searchResults}
        query={q}
        error={error}
      />
    );
  });

  // GET /log/entry/:entryId/edit - Edit entry form
  app.page("/log/entry/:entryId/edit", async (c) => {
    const entryId = parsePositiveInt(c.req.param("entryId"));
    if (!entryId) {
      return c.html(<Layout title="Bad Request"><p>Invalid entry ID</p></Layout>, 400);
    }

    const error = c.req.query("error");
    const d = getDatabase();
    const entry = getFoodEntry(d, entryId);
    if (!entry) {
      return c.html(<Layout title="Not Found"><p>Entry not found</p></Layout>, 404);
    }

    const log = d
      .query("SELECT log_date FROM daily_log WHERE id = ?")
      .get(entry.daily_log_id) as { log_date: string } | null;
    const date = log?.log_date ?? "";

    let food: FoodCatalog | null = null;
    if (entry.food_catalog_id) food = getFoodById(d, entry.food_catalog_id);

    return c.html(
      <EntryForm
        date={date}
        slot={entry.meal_slot}
        food={food}
        entry={entry}
        error={error}
      />
    );
  });
}
