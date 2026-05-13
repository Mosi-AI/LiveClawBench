import { registerAdminRoutes } from "./admin";
import { registerLogRoutes } from "./log";
import { registerPlanRoutes } from "./plans";
import type { MintDietApp, RouteDeps } from "./types";

export function registerRoutes(app: MintDietApp, deps: RouteDeps) {
  app.get("/__mock_sentinel__/mint-diet", (c) =>
    c.json({ mock: "mint-diet", sentinel: true })
  );

  app.get("/", (c) => c.redirect("/log", 302));

  registerLogRoutes(app, deps);
  registerPlanRoutes(app, deps);
  registerAdminRoutes(app, deps);
}
