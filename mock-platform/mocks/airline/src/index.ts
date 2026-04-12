import { createMockApp } from "mock-lib";

const app = createMockApp({ name: "airline" });

// Airline-specific routes will be added in Plan 2 migration tasks.
// For Plan 1, the mock only needs to compile and respond to /health.

export default app;
