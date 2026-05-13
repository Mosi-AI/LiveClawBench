import type { Database } from "bun:sqlite";
import type { OpenAPIApp } from "mock-lib";

export interface RouteDeps {
  getDatabase: () => Database;
}

// Alias for OpenAPIApp - use the framework type directly per mock conventions
export type MintDietApp = OpenAPIApp;
