import { createMockApp, startServer } from "mock-lib";

const app = createMockApp({ name: "email" });

// Email-specific routes will be added in Plan 2 migration tasks.

startServer(app);
