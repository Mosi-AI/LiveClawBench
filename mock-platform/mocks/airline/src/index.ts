import { z } from "zod";
import { createMockApp, createRoute, startServer } from "mock-lib";

export function createAirlineApp() {
  const mockApp = createMockApp({
    name: "airline",
    port: 5000,
    openApi: {
      enabled: true,
      title: "Airline Mock API",
      version: "1.0.0",
    },
  });

  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/airline",
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
  const mockApp = createAirlineApp();
  startServer(mockApp);
}
