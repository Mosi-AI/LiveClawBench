/** @jsxImportSource hono/jsx */
import { createOpenAPIMockApp, startServer } from "mock-lib";
import type { MockAppV2 } from "mock-lib";
import { registerHealthRoutes } from "./routes/health";
import { registerAllergenRoutes } from "./routes/allergens";
import { registerMedicationRoutes } from "./routes/medications";
import { registerAdminRoutes } from "./routes/admin";
import { registerFrontendRoutes } from "./routes/frontend.tsx";
import { initDb } from "./db";
import { seedDatabase } from "./seed";
import stylesCss from "../public/styles.css" with { type: "text" };
import appJs from "../public/app.js" with { type: "text" };

export function createHealthApp(): MockAppV2 {
  const mockApp = createOpenAPIMockApp(
    { name: "health", port: 5007 },
    { title: "Health Mock API", version: "1.0.0" },
  );

  const { app } = mockApp;

  app.get("/__mock_sentinel__/health", (c) => c.json({ ok: true }));

  app.get("/static/styles.css", (c) => {
    return c.body(stylesCss, 200, { "Content-Type": "text/css; charset=utf-8" });
  });
  app.get("/static/app.js", (c) => {
    return c.body(appJs, 200, { "Content-Type": "application/javascript; charset=utf-8" });
  });
  registerHealthRoutes(app);
  registerAllergenRoutes(app);
  registerMedicationRoutes(app);
  registerAdminRoutes(app);
  registerFrontendRoutes(app);

  const seed = async () => {
    const db = initDb();
    seedDatabase(db);
  };

  return { ...mockApp, seed };
}

if (import.meta.main) {
  const mockApp = createHealthApp();
  startServer(mockApp, { seed: mockApp.seed });
}
