import { createMockApp, startServer } from "mock-lib";

const app = createMockApp({ name: "browser-portal" });

// Sentinel route for binary isolation verification (AC-1.1).
app.app.get("/__mock_sentinel__/browser-portal", (c) =>
  c.json({ mock: "browser-portal", sentinel: true }),
);

// Browser portal routes will be added in Plan 2 migration tasks.

startServer(app);
