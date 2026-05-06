import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface CalendarDbOptions {
  dbPath?: string;
}

export function getCalendarDb(options?: CalendarDbOptions): Database {
  const path =
    options?.dbPath ??
    process.env.CALENDAR_DB_PATH ??
    "/var/lib/mock-data/calendar/calendar.db";
  if (path !== ":memory:") {
    try {
      mkdirSync(dirname(path), { recursive: true });
    } catch {
      const db = new Database(":memory:", { create: true });
      initSchema(db);
      return db;
    }
  }
  const db = new Database(path, { create: true });
  initSchema(db);
  return db;
}

const DROP_ORDER = ["calendar_event", "users"] as const;

export function resetCalendarDb(db: Database): void {
  for (const table of DROP_ORDER) {
    db.run(`DROP TABLE IF EXISTS ${table}`);
  }
  initSchema(db);
}

export function initSchema(db: Database): void {
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA busy_timeout = 5000");
  db.run("PRAGMA synchronous = NORMAL");
  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS calendar_event (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      source TEXT,
      source_ref TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_event_user ON calendar_event(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_event_time ON calendar_event(start_time, end_time)`);

  console.log("calendar: schema initialized with WAL mode");
}
