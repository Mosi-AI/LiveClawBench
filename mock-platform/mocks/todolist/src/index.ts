import { createMockApp, startServer } from "mock-lib";

const app = createMockApp({ name: "todolist" });

// Sentinel route for binary isolation verification (AC-1.1).
app.app.get("/__mock_sentinel__/todolist", (c) =>
  c.json({ mock: "todolist", sentinel: true }),
);

// TodoList-specific routes will be added in Plan 2 migration tasks.

startServer(app);
