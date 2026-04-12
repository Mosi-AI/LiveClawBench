import { createMockApp, startServer } from "mock-lib";

const app = createMockApp({ name: "shop" });

// Shop-specific routes will be added in Plan 2 migration tasks.

startServer(app);
