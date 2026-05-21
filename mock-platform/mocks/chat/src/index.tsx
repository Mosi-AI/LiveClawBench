/** @jsxImportSource hono/jsx */
/**
 * Chat mock service — Sticker Manager MVP
 *
 * Port: 5003
 * Provides sticker upload, listing, and deletion via Bun + Hono + TSX + SQLite.
 * Compiles to standalone mock-chat binary.
 */

import { createMockApp, createRoute, startServer, registerStaticAssets } from "mock-lib";
import type { MockAppV2 } from "mock-lib";
import { z } from "zod";
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { seed } from "./data/seed.js";
import { registerStickerRoutes } from "./routes/stickers.js";
import { registerStoreRoutes } from "./routes/store.js";
import { registerChatRoutes } from "./routes/chat.js";
import { StickerManagerPage } from "./components/sticker-manager-page.js";
import { StorePage } from "./components/store-page.js";
import { ChatRoomPage } from "./components/chat-page.js";
import type { ChatConfig, DbState } from "./types.js";

const DEFAULT_DB_PATH = "/opt/mock/data/chat/chat.sqlite";
const DEFAULT_STICKER_DIR = "/opt/mock/data/chat/stickers";
const PORT = 5003;

function resolveConfig(options?: { dbPath?: string; stickerDir?: string }): ChatConfig {
  const dbPath = options?.dbPath ?? process.env.CHAT_DB_PATH ?? DEFAULT_DB_PATH;
  const stickerDir = options?.stickerDir ?? process.env.CHAT_STICKER_DIR ?? DEFAULT_STICKER_DIR;
  return { dbPath, stickerDir };
}

export function createChatApp(options?: { dbPath?: string; stickerDir?: string }): MockAppV2 {
  const config = resolveConfig(options);

  // No side effects here — db starts as null
  const dbState: DbState = { db: null, config };

  const mockApp = createMockApp({
    name: "chat-mock",
    port: PORT,
    healthResponse: { status: "healthy", service: "chat-mock" },
    openApi: {
      enabled: true,
      title: "Chat Mock API",
      version: "1.0.0",
    },
  });

  const { config: appConfig, app } = mockApp;

  registerStaticAssets(app, {
    dir: config.stickerDir,
    prefix: "/static/chat/stickers",
  });

  registerStaticAssets(app, {
    dir: join(import.meta.dir, "../static/store"),
    prefix: "/static/chat/store",
  });

  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/chat",
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
  app.openApiRoute(sentinelRoute, (c) => c.json({ ok: true }));

  app.get("/", (c) => c.redirect("/chat"));

  app.page("/store", (c) => {
    const db = dbState.db;
    return c.html(<StorePage db={db} />);
  });

  app.page("/chat", (c) => {
    const db = dbState.db;
    const channelParam = c.req.query("channel");
    const channelId = channelParam ? parseInt(channelParam, 10) : undefined;
    return c.html(<ChatRoomPage db={db} selectedChannelId={channelId} />);
  });

  app.page("/stickers", (c) => {
    const db = dbState.db;
    return c.html(<StickerManagerPage db={db} />);
  });

  registerStickerRoutes(app, dbState);
  registerStoreRoutes(app, dbState);
  registerChatRoutes(app, dbState);

  return {
    ...mockApp,
    seed: async () => {
      // All side effects happen here
      if (config.dbPath !== ":memory:") {
        mkdirSync(dirname(config.dbPath), { recursive: true });
      }
      mkdirSync(config.stickerDir, { recursive: true });

      const db = new Database(config.dbPath, { create: true });
      db.run("PRAGMA foreign_keys = ON");
      dbState.db = db;

      seed(db, config);
    },
  };
}

if (import.meta.main) {
  const app = createChatApp(resolveConfig());
  startServer(app);
}
