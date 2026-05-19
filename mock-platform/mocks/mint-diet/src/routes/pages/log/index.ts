import type { OpenAPIApp } from "mock-lib";
import type { RouteDeps } from "../../types";
import { registerLogEntryRoutes } from "./entries";
import { registerLogViewRoutes } from "./views";

export function registerLogPageRoutes(app: OpenAPIApp, deps: RouteDeps) {
  registerLogEntryRoutes(app, deps);
  registerLogViewRoutes(app, deps);
}
