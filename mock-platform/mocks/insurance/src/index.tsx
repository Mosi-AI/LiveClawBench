/** @jsxImportSource hono/jsx */
import { z } from "zod";
import {
  createMockApp,
  createRoute,
  startServer,
  registerStaticAssets,
} from "mock-lib";
import type { MockAppV2 } from "mock-lib";
import { getInsuranceDb } from "./db";
import { seedDatabase } from "./seed";
import { registerAuthRoutes } from "./routes/auth";
import { registerClaimsRoutes } from "./routes/claims";
import { registerAppointmentRoutes } from "./routes/appointments";
import { registerPlansRoutes } from "./routes/plans";
import { registerPageRoutes } from "./page-routes";

export function createInsuranceApp(): MockAppV2 {
  const mockApp = createMockApp({
    name: "insurance",
    port: 6000,
    openApi: {
      enabled: true,
      title: "Insurance Mock API",
      version: "1.0.0",
    },
  });
  const { app } = mockApp;
  const db = getInsuranceDb();

  // Sentinel route for isolation verification.
  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/insurance",
    summary: "Binary isolation probe",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              ok: z.boolean(),
              mock: z.literal("insurance"),
            }),
          },
        },
        description: "OK",
      },
    },
  });

  app.openApiRoute(sentinelRoute, (c) =>
    c.json({ ok: true, mock: "insurance" as const }),
  );

  // Adapt insurance_token cookie → Bearer header so authRequired() can find it.
  // Both the SSR portal and the API login write insurance_token; this lets API
  // routes authenticate browser sessions that only have the cookie, not a
  // separate Authorization header.
  app.use("/api/*", async (c, next) => {
    if (!c.req.header("Authorization")) {
      const cookieToken = c.req.header("cookie")?.match(/(?:^|;\s*)insurance_token=([^;]*)/)?.[1];
      if (cookieToken) {
        c.req.raw.headers.set("Authorization", `Bearer ${cookieToken}`);
      }
    }
    await next();
  });

  // API routes
  registerAuthRoutes(app, db);
  registerClaimsRoutes(app, db);
  registerAppointmentRoutes(app, db);
  registerPlansRoutes(app, db);

  // Static assets
  registerStaticAssets(app, {
    dir: "/opt/mock/static/insurance",
    prefix: "/static",
  });

  // Page routes (SSR)
  registerPageRoutes(app, db);

  return {
    ...mockApp,
    seed: () => {
      seedDatabase(db);
    },
  };
}

if (import.meta.main) {
  const app = createInsuranceApp();
  startServer(app);
}
