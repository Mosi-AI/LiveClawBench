import { createMockApp, startServer } from "mock-lib";
import { initDatabase } from "./db";
import { registerRoutes } from "./routes";

export function createSmarthomeApp() {
  const app = createMockApp({
    name: "smarthome",
    port: 5004,
    healthResponse: { ok: true, status: "healthy", service: "smarthome" },
    openApi: {
      enabled: true,
      title: "Smart Home Mock API",
      version: "1.0.0",
    },
    routes: registerRoutes,
  });

  app.seed = () => {
    initDatabase();
  };

  return app;
}

if (import.meta.main) {
  const app = createSmarthomeApp();
  startServer(app);
}
