import { createMockApp, startServer, createRoute, ok, err } from "mock-lib";
import type { MockAppV2, OpenAPIApp } from "mock-lib";
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { z } from "zod";
import { createTables } from "./schema";
import { seedFoodCatalog } from "./seeds";
import { registerRoutes } from "./routes";

export function createMintDietApp(): MockAppV2 {
  let db: Database | undefined;
  const getDatabase = (): Database => {
    if (!db) throw new Error("Database not initialized. Startup may have failed.");
    return db;
  };

  const mockApp = createMockApp({
    name: "mint-diet",
    port: 5003,
    healthResponse: { ok: true, status: "healthy", service: "mint-diet" },
    openApi: {
      enabled: true,
      title: "MintDiet Mock API",
      version: "1.0.0",
    },
  });

  const { app } = mockApp;

  // Sentinel route for binary isolation verification
  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/mint-diet",
    summary: "Binary isolation probe",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ ok: z.boolean() }),
          },
        },
        description: "OK",
      },
    },
  });

  app.openApiRoute(sentinelRoute, (c) => c.json(ok({ ok: true })));

  // Register all routes
  registerRoutes(app as OpenAPIApp, { getDatabase });

  return {
    ...mockApp,
    seed: async () => {
      const dataDir = process.env.MOCK_DATA_DIR ?? "/var/lib/mock-data/mint-diet";
      const dbPath = `${dataDir}/mint-diet.sqlite`;
      mkdirSync(dataDir, { recursive: true });
      db = new Database(dbPath, { create: true });
      db.run("PRAGMA journal_mode = WAL");
      db.run("PRAGMA foreign_keys = ON");
      createTables(db);
      seedFoodCatalog(db);
    },
  };
}

if (import.meta.main) {
  startServer(createMintDietApp());
}
