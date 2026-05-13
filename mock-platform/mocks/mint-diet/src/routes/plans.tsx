// Re-export from split modules for backward compatibility
export { registerPlanListRoutes, registerPlanDetailRoutes, registerPlanMealRoutes } from "./index";

// Re-export a combined register function for backward compatibility
import { registerPlanListRoutes } from "./plans-list";
import { registerPlanDetailRoutes } from "./plans-detail";
import { registerPlanMealRoutes } from "./plans-meals";
import type { MintDietApp, RouteDeps } from "./types";

/** @deprecated Use individual route modules instead */
export function registerPlanRoutes(app: MintDietApp, deps: RouteDeps) {
  registerPlanListRoutes(app, deps);
  registerPlanDetailRoutes(app, deps);
  registerPlanMealRoutes(app, deps);
}
