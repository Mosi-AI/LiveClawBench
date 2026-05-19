// Re-export from split modules
export { registerPlanMealItemRoutes, registerPlanMealIngredientRoutes } from "./index";

// Combined register function for backward compatibility
import { registerPlanMealItemRoutes } from "./plans-meals-items";
import { registerPlanMealIngredientRoutes } from "./plans-meals-ingredients";
import type { MintDietApp, RouteDeps } from "./types";

export function registerPlanMealRoutes(app: MintDietApp, deps: RouteDeps) {
  registerPlanMealItemRoutes(app, deps);
  registerPlanMealIngredientRoutes(app, deps);
}
