import { createMockApp, startServer } from "mock-lib";

const app = createMockApp({ name: "email" });

// Sentinel route for binary isolation verification.
app.app.get("/__mock_sentinel__/email", (c) =>
  c.json({ mock: "email", sentinel: true }),
);

// Email-specific routes will be added in Plan 2 migration tasks.

startServer(app);
