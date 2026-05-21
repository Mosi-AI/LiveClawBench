/**
 * Database schema initialization for chat mock service.
 *
 * All tables use CREATE TABLE IF NOT EXISTS for idempotency.
 * Foreign key constraints rely on PRAGMA foreign_keys = ON being
 * enabled by the caller immediately after Database creation.
 */

import type { Database } from "bun:sqlite";

export function ensureTables(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS mock_user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS channel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES mock_user(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('direct','group','system')) DEFAULT 'group',
      last_message_preview TEXT,
      updated_at TEXT NOT NULL,
      unread_count INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS message (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
      sender TEXT NOT NULL,
      body TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      message_kind TEXT NOT NULL CHECK(message_kind IN ('chat','structured_brief','thread_sync','sticker')) DEFAULT 'chat',
      source_ref TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sticker_pack (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      previews_json TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_sticker (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES mock_user(id) ON DELETE CASCADE,
      pack_id INTEGER REFERENCES sticker_pack(id) ON DELETE SET NULL,
      category TEXT NOT NULL CHECK(category IN ('recent','favorite','custom')) DEFAULT 'custom',
      storage_path TEXT NOT NULL,
      mime_type TEXT NOT NULL CHECK(mime_type IN ('image/gif','image/png','image/jpeg','image/svg+xml')),
      created_at TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_sticker_pack (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES mock_user(id) ON DELETE CASCADE,
      sticker_pack_id INTEGER NOT NULL REFERENCES sticker_pack(id) ON DELETE CASCADE,
      acquired_at TEXT NOT NULL,
      UNIQUE(user_id, sticker_pack_id)
    )
  `);
}
