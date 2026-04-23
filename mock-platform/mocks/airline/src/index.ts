import { z } from "zod";
import { createMockApp, createRoute, startServer } from "mock-lib";

export function createAirlineApp() {
  const { config, app } = createMockApp({
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

  app.openApiRoute(sentinelRoute, (c) => c.json({ ok: true }));

  return { config, app };
}

if (import.meta.main) {
  const { config, app } = createAirlineApp();
  startServer({ config, app });
}
