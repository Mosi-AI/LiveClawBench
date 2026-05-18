import { z } from "zod";
import { existsSync } from "node:fs";
import { createMockApp, createRoute, registerFrontendFallback, startServer } from "mock-lib";
import { getEmailDb, initSchema } from "./db";
import { seedDatabase } from "./seed";
import { registerAuthRoutes } from "./routes/auth";
import { registerEmailRoutes } from "./routes/emails";
import { registerAttachmentRoutes } from "./routes/attachments";
import { registerUserRoutes } from "./routes/users";

export function createEmailApp(options?: { dbPath?: string }) {
  const db = getEmailDb({ path: options?.dbPath });
  initSchema(db);
  seedDatabase(db);

  const mockApp = createMockApp({
    name: "email",
    port: 5001,
    healthResponse: { ok: true, status: "healthy", service: "email" },
    openApi: {
      enabled: true,
      title: "Email Mock API",
      version: "1.0.0",
    },
  });

  const { app } = mockApp;

  // Sentinel route for binary isolation verification
  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/email",
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

  // Register all route modules
  registerAuthRoutes(app, db);
  registerEmailRoutes(app, db);
  registerAttachmentRoutes(app, db);
  registerUserRoutes(app, db);

  // SPA fallback for frontend assets (must be last)
  const frontendDir = existsSync("/opt/mock/frontend/email") ? "/opt/mock/frontend/email" : undefined;
  if (frontendDir) {
    registerFrontendFallback(app, frontendDir);
  }

  return { ...mockApp, seed: () => seedDatabase(db) };
}

if (import.meta.main) {
  const mockApp = createEmailApp();
  startServer(mockApp);
}
