import { Database } from "bun:sqlite";
import { getDb, resetDb } from "mock-lib";

const DEFAULT_DB_PATH = ":memory:";

export function getCalendarDb(options?: { path?: string }): Database {
  const path = options?.path ?? process.env.CALENDAR_DB_PATH ?? DEFAULT_DB_PATH;
  if (path === ":memory:") {
    return new Database(":memory:", { create: true });
  }
  return getDb({ path });
}

export function resetCalendarDb(): void {
  resetDb();
}

export function initSchema(db: Database): void {
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA synchronous = NORMAL;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_event (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      description TEXT,
      source TEXT,
      source_ref TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_event_user_start ON calendar_event(user_id, start_time);
  `);
}
