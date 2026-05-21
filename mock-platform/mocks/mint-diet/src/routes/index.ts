import type { OpenAPIApp } from "mock-lib";
import type { RouteDeps } from "./types";

// API routes (Zod schema-first)
import { registerFoodCatalogRoutes } from "./api/food-catalog";
import { registerLogEntryRoutes } from "./api/log-entries";
import { registerMealPlanRoutes } from "./api/meal-plans";
import { registerPlanItemRoutes } from "./api/plan-items";
import { registerIngredientRoutes } from "./api/ingredients";
import { registerAdminRoutes as registerAdminApiRoutes } from "./api/admin";

// HTML page routes
import { registerLogPageRoutes } from "./pages/log";
import { registerPlanPageRoutes } from "./pages/plans";

export function registerRoutes(app: OpenAPIApp, deps: RouteDeps) {
  const { getDatabase } = deps;

  // Home redirect
  app.page("/", (c) => c.redirect("/log", 302));

  // Register API routes
  registerFoodCatalogRoutes(app, getDatabase);
  registerLogEntryRoutes(app, getDatabase);
  registerMealPlanRoutes(app, getDatabase);
  registerPlanItemRoutes(app, getDatabase);
  registerIngredientRoutes(app, getDatabase);
  registerAdminApiRoutes(app, getDatabase);

  // Register HTML page routes
  registerLogPageRoutes(app, deps);
  registerPlanPageRoutes(app, deps);
}
