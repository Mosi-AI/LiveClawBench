import { z } from "zod";
import { createMockApp, createRoute, startServer } from "mock-lib";

export function createTodolistApp() {
  const mockApp = createMockApp({
    name: "todolist",
    port: 5002,
    openApi: {
      enabled: true,
      title: "Todolist Mock API",
      version: "1.0.0",
    },
  });

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

  mockApp.app.openApiRoute(sentinelRoute, (c) => c.json({ ok: true }));

  return mockApp;
}

if (import.meta.main) {
  const mockApp = createTodolistApp();
  startServer(mockApp);
}
