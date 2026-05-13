import { Database } from "bun:sqlite";
import { getDb, resetDb } from "mock-lib";

const DEFAULT_DB_PATH = ":memory:";

export function getTodolistDb(options?: { path?: string }): Database {
  const path = options?.path ?? process.env.TODOLIST_DB_PATH ?? DEFAULT_DB_PATH;
  // Bypass the process-level singleton for in-memory DBs so that
  // spec-generation (which instantiates multiple mocks in one process)
  // and tests each get a fresh database.
  if (path === ":memory:") {
    return new Database(":memory:", { create: true });
  }
  return getDb({ path });
}

export function resetTodolistDb(): void {
  // Resets the process-level singleton (file-backed DBs only).
  // In-memory DBs bypass the singleton, so this is a no-op in tests.
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
