import { createMockApp, startServer } from "mock-lib";

const app = createMockApp({ name: "shop" });

// Sentinel route for binary isolation verification (AC-1.1).
app.app.get("/__mock_sentinel__/shop", (c) =>
  c.json({ mock: "shop", sentinel: true }),
);

// Shop-specific routes will be added in Plan 2 migration tasks.

startServer(app);
