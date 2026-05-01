import { z } from "zod";
import { createMockApp, createRoute, startServer } from "mock-lib";
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

export function createAirlineApp(options?: { dbPath?: string }) {
  const db = getAirlineDb({ dbPath: options?.dbPath });
  initSchema(db);
  seedDatabase(db);

  const mockApp = createMockApp({
    name: "airline",
    port: 5000,
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

  return mockApp;
}

if (import.meta.main) {
  const mockApp = createAirlineApp();
  startServer(mockApp);
}
