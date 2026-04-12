import { createMockApp, startServer } from "mock-lib";

const app = createMockApp({ name: "browser-portal" });

// Browser portal routes will be added in Plan 2 migration tasks.

startServer(app);
