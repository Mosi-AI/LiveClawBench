import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { z } from "zod";
import { SystemConfigResponseSchema } from "../schemas/system-config";

export function registerSystemConfigRoutes(app: OpenAPIApp, db: Database) {
  const route = createRoute({
    method: "get",
    path: "/api/system-config",
    summary: "Get system config",
    responses: {
      200: {
        description: "System config values",
        content: { "application/json": { schema: SystemConfigResponseSchema } },
      },
    },
  });

  app.openApiRoute(route, (c) => {
    const rows = db
      .query<{ config_key: string; config_value: string }, []>(
        "SELECT config_key, config_value FROM system_config"
      )
      .all();
    const config: Record<string, string> = {};
    for (const row of rows) {
      config[row.config_key] = row.config_value;
    }
    return c.json(config);
  }, { auth: "required" });
}
