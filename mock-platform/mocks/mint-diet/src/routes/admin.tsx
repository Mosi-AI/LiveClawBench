import { Layout } from "../components";
import { isResponse, runDbMutation } from "./helpers";
import type { MintDietApp, RouteDeps } from "./types";

export function registerAdminRoutes(app: MintDietApp, { getDatabase }: RouteDeps) {
  app.post("/admin/reset", async (c) => {
    if (!process.env.MOCK_ADMIN || process.env.MOCK_ADMIN !== "1") {
      return c.html(<Layout title="Not Found"><p>Not found</p></Layout>, 404);
    }

    const d = getDatabase();
    const reset = runDbMutation(c, () => d.transaction(() => {
      d.run("DELETE FROM ingredient_item");
      d.run("DELETE FROM meal_plan_item");
      d.run("DELETE FROM meal_plan_day");
      d.run("DELETE FROM food_entry");
      d.run("DELETE FROM meal_plan");
      d.run("DELETE FROM daily_log");
    })());
    if (isResponse(reset)) return reset;
    const checkpoint = runDbMutation(c, () => d.run("PRAGMA wal_checkpoint(FULL)"));
    if (isResponse(checkpoint)) return checkpoint;

    return c.redirect("/", 303);
  });
}
