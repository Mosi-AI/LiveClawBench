import { createMockApp, startServer } from "mock-lib";
import type { MockAppV2 } from "mock-lib";
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { createTables } from "./schema";
import { seedFoodCatalog } from "./seeds";
import { registerRoutes } from "./routes";
import type { MintDietApp } from "./routes/types";

export function createMintDietApp(): MockAppV2 {
  let db: Database | undefined;
  const getDatabase = (): Database => {
    if (!db) throw new Error("Database not initialized. Startup may have failed.");
    return db;
  };

  const mockApp = createMockApp({
    name: "mint-diet",
    port: 5003,
    routes: (app) => {
      registerRoutes(app as unknown as MintDietApp, { getDatabase });
    },
  });

  mockApp.seed = () => {
    const dataDir = process.env.MOCK_DATA_DIR ?? "/var/lib/mock-data/mint-diet";
    const dbPath = `${dataDir}/mint-diet.sqlite`;
    mkdirSync(dataDir, { recursive: true });
    db = new Database(dbPath, { create: true });
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA foreign_keys = ON");
    createTables(db);
    seedFoodCatalog(db);
  };

  return mockApp;
}

if (import.meta.main) {
  startServer(createMintDietApp());
}
