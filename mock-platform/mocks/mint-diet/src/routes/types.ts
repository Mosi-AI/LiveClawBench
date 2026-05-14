import type { AppEnv } from "mock-lib";
import type { Database } from "bun:sqlite";
import type { Hono } from "hono";

export interface RouteDeps {
  getDatabase: () => Database;
}

export type MintDietApp = Hono<AppEnv>;
