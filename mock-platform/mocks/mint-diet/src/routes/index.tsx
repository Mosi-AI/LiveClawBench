import { createRoute } from "mock-lib";
import { z } from "zod";
import { registerAdminRoutes } from "./admin";
import { registerLogViewRoutes } from "./log-views";
import { registerLogEntryCreateRoutes } from "./log-entries-create";
import { registerLogEntryUpdateRoutes } from "./log-entries-update";
import { registerLogEntryDeleteRoutes } from "./log-entries-delete";
import { registerPlanListRoutes } from "./plans-list";
import { registerPlanDetailRoutes } from "./plans-detail";
import { registerPlanMealItemRoutes } from "./plans-meals-items";
import { registerPlanMealIngredientRoutes } from "./plans-meals-ingredients";
import type { MintDietApp, RouteDeps } from "./types";

// Re-export all route modules for backward compatibility
export { registerLogViewRoutes } from "./log-views";
export { registerLogEntryCreateRoutes } from "./log-entries-create";
export { registerLogEntryUpdateRoutes } from "./log-entries-update";
export { registerLogEntryDeleteRoutes } from "./log-entries-delete";
export { registerPlanListRoutes } from "./plans-list";
export { registerPlanDetailRoutes } from "./plans-detail";
export { registerPlanMealItemRoutes } from "./plans-meals-items";
export { registerPlanMealIngredientRoutes } from "./plans-meals-ingredients";
export { registerAdminRoutes } from "./admin";

export function registerRoutes(app: MintDietApp, deps: RouteDeps) {
  // Sentinel route - registered via createRoute + app.openApiRoute per conventions
  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/mint-diet",
    summary: "Binary isolation probe",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ mock: z.literal("mint-diet"), sentinel: z.boolean() }),
          },
        },
        description: "OK",
      },
    },
  });

  app.openApiRoute(sentinelRoute, (c) =>
    c.json({ mock: "mint-diet", sentinel: true })
  );

  app.page("/", (c) => c.redirect("/log", 302));

  registerLogViewRoutes(app, deps);
  registerLogEntryCreateRoutes(app, deps);
  registerLogEntryUpdateRoutes(app, deps);
  registerLogEntryDeleteRoutes(app, deps);
  registerPlanListRoutes(app, deps);
  registerPlanDetailRoutes(app, deps);
  registerPlanMealItemRoutes(app, deps);
  registerPlanMealIngredientRoutes(app, deps);
  registerAdminRoutes(app, deps);
}
