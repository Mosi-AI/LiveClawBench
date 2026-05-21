/**
 * Seed logic for chat mock service.
 *
 * Idempotent: re-running does not create duplicate rows.
 * Fatal on failure: any error causes process.exit(1).
 */

import { mkdirSync, copyFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Database } from "bun:sqlite";
import { ensureTables } from "../db/schema.js";
import type { ChatConfig } from "../types.js";

function resolveStoreAssetsDir(): string {
  if (process.env.CHAT_STORE_ASSETS_DIR) return process.env.CHAT_STORE_ASSETS_DIR;
  const candidates = [
    "/opt/mock/static/store",
    join(import.meta.dir, "../../static/store"),
    join(import.meta.dir, "../static/store"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return "/opt/mock/static/store";
}

const STORE_ASSETS_DIR = resolveStoreAssetsDir();

function seedMockUser(db: Database): void {
  const existing = db.query("SELECT 1 FROM mock_user WHERE id = 1").get();
  if (!existing) {
    db.run("INSERT INTO mock_user (id, display_name) VALUES (1, 'You')");
  }
}

function seedChannels(db: Database): void {
  const channels = [
    { id: 1, name: "#general" },
    { id: 2, name: "#pets" },
    { id: 3, name: "#space" },
  ];

  for (const ch of channels) {
    const existing = db.query("SELECT 1 FROM channel WHERE id = ?").get(ch.id);
    if (!existing) {
      db.run(
        `INSERT INTO channel (id, user_id, name, kind, last_message_preview, updated_at, unread_count)
         VALUES (?, 1, ?, 'group', NULL, ?, 0)`,
        [ch.id, ch.name, new Date().toISOString()],
      );
    }
  }
}

function seedMessages(db: Database): void {
  const messages = [
    { id: 1, channel_id: 2, sender: "Alice", body: "I love cats, send me a cat sticker!" },
    { id: 2, channel_id: 2, sender: "Bob", body: "Dogs are great too!" },
    { id: 3, channel_id: 3, sender: "Charlie", body: "Show me a rocket sticker!" },
  ];

  for (const msg of messages) {
    const existing = db.query("SELECT 1 FROM message WHERE id = ?").get(msg.id);
    if (!existing) {
      db.run(
        `INSERT INTO message (id, channel_id, sender, body, sent_at, message_kind, source_ref)
         VALUES (?, ?, ?, ?, ?, 'chat', NULL)`,
        [msg.id, msg.channel_id, msg.sender, msg.body, new Date().toISOString()],
      );
    }
  }
}

function seedStickerPacks(db: Database): void {
  const packs = [
    { id: 1, title: "Cute Cats", provider_name: "Meow Studios", previews: [
      { filename: "cat-1.svg", label: "Sleepy Cat" },
      { filename: "cat-2.svg", label: "Playful Cat" },
      { filename: "cat-3.svg", label: "Curious Cat" },
    ]},
    { id: 2, title: "Space Adventure", provider_name: "Cosmic Co", previews: [
      { filename: "space-1.svg", label: "Rocket" },
      { filename: "space-2.svg", label: "Astronaut" },
      { filename: "space-3.svg", label: "Planet" },
    ]},
    { id: 3, title: "Happy Dogs", provider_name: "Bark Inc", previews: [
      { filename: "dog-1.svg", label: "Puppy" },
      { filename: "dog-2.svg", label: "Running Dog" },
      { filename: "dog-3.svg", label: "Sleepy Dog" },
    ]},
    { id: 4, title: "Foodie Fun", provider_name: "Yummy Arts", previews: [
      { filename: "food-1.svg", label: "Pizza" },
      { filename: "food-2.svg", label: "Burger" },
      { filename: "food-3.svg", label: "Ice Cream" },
    ]},
  ];

  for (const pack of packs) {
    const existing = db.query("SELECT 1 FROM sticker_pack WHERE id = ?").get(pack.id);
    if (!existing) {
      db.run(
        "INSERT INTO sticker_pack (id, title, provider_name, sort_order, previews_json) VALUES (?, ?, ?, ?, ?)",
        [pack.id, pack.title, pack.provider_name, pack.id, JSON.stringify(pack.previews)],
      );
    }
  }
}

function seedInitialStickers(db: Database, stickerDir: string): void {
  // Seed 2 custom stickers (pack_id = NULL) so the sticker picker is never empty
  const initialStickers = [
    { id: 1, filename: "food-1.svg", label: "Pizza" },
    { id: 2, filename: "food-2.svg", label: "Burger" },
  ];

  for (const st of initialStickers) {
    const existing = db.query("SELECT 1 FROM user_sticker WHERE id = ?").get(st.id);
    if (!existing) {
      const srcPath = join(STORE_ASSETS_DIR, st.filename);
      const uuid = crypto.randomUUID();
      const destFilename = `${uuid}.svg`;
      const destPath = join(stickerDir, destFilename);
      const storagePath = `/static/chat/stickers/${destFilename}`;

      copyFileSync(srcPath, destPath);

      db.run(
        "INSERT INTO user_sticker (id, user_id, pack_id, category, storage_path, mime_type, created_at, sort_order) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)",
        [st.id, 1, "recent", storagePath, "image/svg+xml", new Date().toISOString(), st.id - 1],
      );
    }
  }
}

export function seed(db: Database, config: ChatConfig): void {
  try {
    ensureTables(db);
    seedMockUser(db);
    seedChannels(db);
    seedMessages(db);
    seedStickerPacks(db);
    seedInitialStickers(db, config.stickerDir);

    mkdirSync(config.stickerDir, { recursive: true });
  } catch (err) {
    console.error(
      "mock-chat: FATAL: seed failed:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }
}
