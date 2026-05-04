import { z } from "zod";
import { createMockApp, createRoute, startServer } from "mock-lib";
import { getTodolistDb, initSchema } from "./db";
import { seedDatabase } from "./seed";
import { registerTodoRoutes } from "./routes/todos";

export function createTodolistApp(options?: { dbPath?: string }) {
  const db = getTodolistDb({ path: options?.dbPath });
  initSchema(db);
  seedDatabase(db);

  const mockApp = createMockApp({
    name: "todolist",
    port: 5002,
    openApi: {
      enabled: true,
      title: "Todolist Mock API",
      version: "1.0.0",
    },
  });

  const { app } = mockApp;

  // Health check
  app.get("/api/health", (c) => c.json({ status: "healthy", message: "Todolist API is running" }));

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

  return mockApp;
}

if (import.meta.main) {
  const mockApp = createTodolistApp();
  startServer(mockApp);
}
