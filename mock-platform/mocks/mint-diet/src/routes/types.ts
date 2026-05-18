import type { Database } from "bun:sqlite";
import type { OpenAPIApp } from "mock-lib";

export interface RouteDeps {
  getDatabase: () => Database;
}

export type MintDietApp = OpenAPIApp;
