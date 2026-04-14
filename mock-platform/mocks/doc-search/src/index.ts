import { createMockApp, startServer } from "mock-lib";

const app = createMockApp({ name: "doc-search" });

// Sentinel route for binary isolation verification (AC-1.1).
app.app.get("/__mock_sentinel__/doc-search", (c) =>
  c.json({ mock: "doc-search", sentinel: true }),
);

// Document search routes will be added in Plan 2 migration tasks.

startServer(app);
