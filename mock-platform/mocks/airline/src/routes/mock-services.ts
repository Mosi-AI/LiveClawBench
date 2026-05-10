import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { registerPaymentRoutes } from "./payment";
import { registerMockEmailRoutes } from "./email-notifications";
import { registerCalendarRoutes } from "./calendar";
import { registerChatRoutes } from "./chat";

export function registerMockServiceRoutes(app: OpenAPIApp, db: Database): void {
  registerPaymentRoutes(app, db, "/api");
  registerMockEmailRoutes(app, db, "/api");
  registerCalendarRoutes(app, db, "/api");
  registerChatRoutes(app, db, "/api");
}
