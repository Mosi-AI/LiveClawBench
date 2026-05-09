import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { registerReadEmailRoutes } from "./emails-read";
import { registerComposeEmailRoutes } from "./emails-compose";
import { registerActionEmailRoutes } from "./emails-actions";

export function registerEmailRoutes(app: OpenAPIApp, db: Database): void {
  registerReadEmailRoutes(app, db);
  registerComposeEmailRoutes(app, db);
  registerActionEmailRoutes(app, db);
}
