import type { OpenAPIApp } from "mock-lib";
import type { RouteDeps } from "../../types";
import { registerPlanListRoutes } from "./list";
import { registerPlanDetailRoutes } from "./detail";
import { registerPlanMealsRoutes } from "./meals";

export function registerPlanPageRoutes(app: OpenAPIApp, deps: RouteDeps) {
  registerPlanListRoutes(app, deps);
  registerPlanDetailRoutes(app, deps);
  registerPlanMealsRoutes(app, deps);
}
