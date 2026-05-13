// Re-export from split modules for backward compatibility
export { registerLogViewRoutes, registerLogEntryRoutes } from "./index";
export { isCatalogQuantityUnit, parseManualMacros } from "./log-shared";
export type { ManualMacroValues } from "./log-shared";

// Re-export a combined register function for backward compatibility
import { registerLogViewRoutes } from "./log-views";
import { registerLogEntryRoutes } from "./log-entries";
import type { MintDietApp, RouteDeps } from "./types";

/** @deprecated Use individual route modules instead */
export function registerLogRoutes(app: MintDietApp, deps: RouteDeps) {
  registerLogViewRoutes(app, deps);
  registerLogEntryRoutes(app, deps);
}
