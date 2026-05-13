// Re-export from split modules
export { registerLogEntryCreateRoutes, registerLogEntryUpdateRoutes, registerLogEntryDeleteRoutes } from "./index";

// Combined register function for backward compatibility
import { registerLogEntryCreateRoutes } from "./log-entries-create";
import { registerLogEntryUpdateRoutes } from "./log-entries-update";
import { registerLogEntryDeleteRoutes } from "./log-entries-delete";
import type { MintDietApp, RouteDeps } from "./types";

export function registerLogEntryRoutes(app: MintDietApp, deps: RouteDeps) {
  registerLogEntryCreateRoutes(app, deps);
  registerLogEntryUpdateRoutes(app, deps);
  registerLogEntryDeleteRoutes(app, deps);
}
