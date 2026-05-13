/** @jsxImportSource hono/jsx */
import { z } from "zod";
import {
  createMockApp,
  createRoute,
  registerStaticAssets,
  startServer,
} from "mock-lib";
import type { MockAppV2 } from "mock-lib";
import { getCalendarDb, initSchema } from "./db";
import { seedDatabase } from "./seed";
import { registerEventsRoutes } from "./routes/events";
import { registerPageRoutes } from "./page-routes";

export function createCalendarApp(): MockAppV2 {
  const mockApp = createMockApp({
    name: "calendar",
    port: 5003,
    openApi: {
      enabled: true,
      title: "Calendar Mock API",
      version: "1.0.0",
    },
  });

  const db = getCalendarDb();
  initSchema(db);
  seedDatabase(db);

  // Sentinel route for isolation verification.
  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/calendar",
    summary: "Binary isolation probe",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              ok: z.boolean(),
              mock: z.string(),
            }),
          },
        },
        description: "OK",
      },
    },
  });

  mockApp.app.openApiRoute(sentinelRoute, (c) =>
    c.json({ ok: true, mock: "calendar" }),
  );

  registerEventsRoutes(mockApp.app, db);
  registerStaticAssets(mockApp.app, {
    dir: "/opt/mock/static/calendar",
    prefix: "/static",
  });

  registerPageRoutes(mockApp.app, db);

  return {
    ...mockApp,
    seed: () => seedDatabase(db),
  };
}

if (import.meta.main) {
  const app = createCalendarApp();
  startServer(app);
}
