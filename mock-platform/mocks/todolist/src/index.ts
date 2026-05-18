import { z } from "zod";
import { existsSync } from "node:fs";
import { createMockApp, createRoute, registerFrontendFallback, startServer } from "mock-lib";
import { getTodolistDb, initSchema } from "./db";
import { seedDatabase } from "./seed";
import { registerTodoRoutes } from "./routes/todos";

export function createTodolistApp(options?: { dbPath?: string; taskName?: string }) {
  const db = getTodolistDb({ path: options?.dbPath });
  initSchema(db);
  seedDatabase(db, options?.taskName);

  const mockApp = createMockApp({
    name: "todolist",
    port: 5002,
    healthResponse: { ok: true, status: "healthy", service: "todolist" },
    openApi: {
      enabled: true,
      title: "Todolist Mock API",
      version: "1.0.0",
    },
  });

  const { app } = mockApp;

  // Sentinel route for binary isolation verification
  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/todolist",
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
  registerTodoRoutes(app, db);

  // SPA fallback for frontend assets (must be last)
  const frontendDir = existsSync("/opt/mock/frontend/todolist") ? "/opt/mock/frontend/todolist" : undefined;
  if (frontendDir) {
    registerFrontendFallback(app, frontendDir);
  }

  return { ...mockApp, seed: () => seedDatabase(db, options?.taskName) };
}

if (import.meta.main) {
  const mockApp = createTodolistApp();
  startServer(mockApp);
}
