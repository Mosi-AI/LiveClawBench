import { createMockApp, startServer } from "mock-lib";

const app = createMockApp({ name: "airline" });

// Sentinel route for binary isolation verification (AC-1.1).
// Each mock registers a unique sentinel that build-all.ts checks for
// both presence (own) and absence (foreign) to prove cross-contamination freedom.
app.app.get("/__mock_sentinel__/airline", (c) =>
  c.json({ mock: "airline", sentinel: true }),
);

// Airline-specific routes will be added in Plan 2 migration tasks.

startServer(app);
