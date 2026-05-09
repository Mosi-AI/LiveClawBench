import { createRoute } from "mock-lib";
import { registerAdminRoutes } from "./admin";
import { registerLogRoutes } from "./log";
import { registerPlanRoutes } from "./plans";
import { SentinelResponseSchema } from "./schemas";
import type { MintDietApp, RouteDeps } from "./types";

export function registerRoutes(app: MintDietApp, deps: RouteDeps) {
  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/mint-diet",
    summary: "Binary isolation probe",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: SentinelResponseSchema,
          },
        },
        description: "OK",
      },
    },
  });

  app.openApiRoute(sentinelRoute, (c) =>
    c.json({ mock: "mint-diet", sentinel: true }, 200)
  );

  app.page("/", (c) => c.redirect("/log", 302));

  registerLogRoutes(app, deps);
  registerPlanRoutes(app, deps);
  registerAdminRoutes(app, deps);
}
