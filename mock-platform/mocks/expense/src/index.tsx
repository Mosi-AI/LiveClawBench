/** @jsxImportSource hono/jsx */
import { createMockApp, createRoute, startServer, registerStaticAssets } from "mock-lib";
import type { MockAppV2 } from "mock-lib";
import { z } from "zod";
import { runMigrations, resetDb } from "./db/init.js";
import { seed } from "./db/seed.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerDraftRoutes } from "./routes/drafts.js";
import { registerAttachmentRoutes } from "./routes/attachments.js";
import { registerActivityRoutes } from "./routes/activities.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerPageRoutes } from "./routes/pages.jsx";

export function createExpenseApp(): MockAppV2 {
  resetDb();

  const mockApp = createMockApp({
    name: "expense",
    port: parseInt(process.env.EXPENSE_MOCK_PORT || "5004", 10),
    healthResponse: { ok: true },
    openApi: {
      enabled: true,
      title: "Expense Mock API",
      version: "1.0.0",
    },
  });

  const { config, app } = mockApp;

  // Static assets from /opt/mock/static/expense/ at /static/
  registerStaticAssets(app, { dir: "/opt/mock/static/expense", prefix: "/static" });

  // Sentinel route for binary isolation verification
  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/expense",
    summary: "Binary isolation probe",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ ok: z.boolean() }),
          },
        },
        description: "OK",
      },
    },
  });

  app.openApiRoute(sentinelRoute, (c) => c.json({ ok: true }));

  // API routes
  registerAuthRoutes(app);
  registerDraftRoutes(app);
  registerAttachmentRoutes(app);
  registerActivityRoutes(app);
  registerReportRoutes(app);

  // HTML page routes
  registerPageRoutes(app);

  return {
    ...mockApp,
    seed: async () => {
      runMigrations();
      seed();
    },
  };
}

if (import.meta.main) {
  const app = createExpenseApp();
  startServer(app);
}
