import { z } from "zod";
import { existsSync } from "node:fs";
import { createMockApp, createRoute, startServer, registerFrontendFallback, verify } from "mock-lib";
import { getAirlineDb, initSchema } from "./db";
import { seedDatabase } from "./seed";
import { registerAuthRoutes } from "./routes/auth";
import { registerProfileRoutes } from "./routes/profile";
import { registerFlightRoutes } from "./routes/flights";
import { registerBookingRoutes } from "./routes/bookings";
import { registerCheckinRoutes } from "./routes/checkin";
import { registerClaimRoutes } from "./routes/claims";
import { registerBaggageRoutes } from "./routes/baggage";
import { registerAnnouncementRoutes } from "./routes/announcements";
import { registerFaqRoutes } from "./routes/faq";
import { registerInfoRoutes } from "./routes/info";
import { registerMockServiceRoutes } from "./routes/mock-services";

export function createAirlineApp(options?: { dbPath?: string; frontendDir?: string }) {
  const db = getAirlineDb({ dbPath: options?.dbPath });
  initSchema(db);
  seedDatabase(db);

  const candidateFrontendDir = options?.frontendDir ?? process.env.FRONTEND_DIR ?? "/opt/mock/frontend/airline";
  const frontendDir = existsSync(candidateFrontendDir) ? candidateFrontendDir : undefined;

  const mockApp = createMockApp({
    name: "airline",
    port: 5000,
    healthResponse: { ok: true, status: "healthy", service: "airline" },
    openApi: {
      enabled: true,
      title: "Airline Mock API",
      version: "1.0.0",
    },
  });

  const { app } = mockApp;

  // Sentinel route for binary isolation verification
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

  // Validate token when present; reject expired/invalid tokens with 401.
  // Auth endpoints (/login, /register, /refresh) are always exempt so clients
  // can recover from expired sessions without clearing cookies manually.
  // Requests with no token proceed without userId (routes fall back to DEFAULT_USER_ID).
  app.use("/api/*", async (c, next) => {
    const path = c.req.path;
    const isAuthEndpoint = path === "/api/auth/login" || path === "/api/auth/register" || path === "/api/auth/refresh";
    if (isAuthEndpoint) {
      await next();
      return;
    }
    const cookieToken = c.req.header("cookie")?.match(/(?:^|;\s*)token=([^;]*)/)?.[1];
    const bearerToken = c.req.header("Authorization")?.startsWith("Bearer ")
      ? c.req.header("Authorization")!.slice(7) : null;
    const token = cookieToken ?? bearerToken ?? null;
    if (token) {
      const payload = await verify(token);
      if (!payload) return c.json({ ok: false, error: "Invalid or expired token" }, 401);
      c.set("userId", payload.userId as number);
    }
    await next();
  });

  // Register all route modules
  registerAuthRoutes(app, db);
  registerProfileRoutes(app, db);
  registerFlightRoutes(app, db);
  registerBookingRoutes(app, db);
  registerCheckinRoutes(app, db);
  registerClaimRoutes(app, db);
  registerBaggageRoutes(app, db);
  registerAnnouncementRoutes(app, db);
  registerFaqRoutes(app, db);
  registerInfoRoutes(app);
  registerMockServiceRoutes(app, db);

  // Register SPA frontend AFTER all API routes.
  // The catch-all app.get("*", ...) must come last to avoid intercepting API routes.
  if (frontendDir) {
    registerFrontendFallback(app, frontendDir);
  }

  return { ...mockApp, db, seed: () => seedDatabase(db) };
}

if (import.meta.main) {
  const mockApp = createAirlineApp();
  startServer(mockApp);
}
