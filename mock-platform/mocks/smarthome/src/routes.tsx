import type { OpenAPIApp } from "mock-lib";
import { registerApiRoutes } from "./routes/api-routes";
import { registerPageRoutes } from "./routes/page-routes";

export function registerRoutes(app: OpenAPIApp): void {
  app.get("/__mock_sentinel__/smarthome", (c) =>
    c.json({ mock: "smarthome", sentinel: true }),
  );

  registerPageRoutes(app);
  registerApiRoutes(app);
}
