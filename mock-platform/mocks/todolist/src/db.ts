import { getDb, resetDb } from "mock-lib";
import type { Database } from "bun:sqlite";

const DEFAULT_DB_PATH = "/var/lib/mock-data/todolist/todolist.db";

export function getTodolistDb(options?: { path?: string }): Database {
  const path = options?.path ?? process.env.TODOLIST_DB_PATH ?? DEFAULT_DB_PATH;
  return getDb({ path });
}

export function resetTodolistDb(): void {
  resetDb();
}

export function initSchema(db: Database): void {
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA synchronous = NORMAL;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      location TEXT,
      person TEXT,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_todos_date ON todos(date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at)`);
}
