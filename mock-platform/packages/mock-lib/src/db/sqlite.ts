import { Database } from "bun:sqlite";

/**
 * SQLite database instances keyed by file path.
 *
 * Each unique path gets its own Database instance. This prevents cross-mock
 * interference when multiple mock tests run concurrently in the same process
 * (e.g., `bun test` runs all test files together).
 *
 * In production each mock runs in its own process, so there is at most one
 * entry per process. The Map design is a safety net for the test runner.
 */

const _dbs = new Map<string, Database>();

export interface SqliteOptions {
  /** Database file path. Use ":memory:" for in-memory databases. */
  path?: string;
  /** If true, creates tables on first access. Default: true */
  autoMigrate?: boolean;
}

const DEFAULT_OPTIONS: SqliteOptions = {
  path: ":memory:",
  autoMigrate: true,
};

/**
 * Get or create the SQLite database for the given path.
 *
 * Each unique path is isolated — calling `getDb({ path: "a.db" })` and
 * `getDb({ path: "b.db" })` returns two independent Database instances.
 */
export function getDb(options?: SqliteOptions): Database {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const path = opts.path ?? ":memory:";

  const cached = _dbs.get(path);
  if (cached) return cached;

  let db: Database;
  try {
    db = new Database(path, { create: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to open SQLite database at ${path}: ${message}`);
  }

  // Enable WAL mode for better concurrent read performance
  try {
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA foreign_keys = ON");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    db.close();
    throw new Error(`Failed to configure SQLite database: ${message}`);
  }

  // Run migrations if autoMigrate is enabled (default behavior)
  if (opts.autoMigrate) {
    migrate(db);
  }

  _dbs.set(path, db);
  return db;
}

/**
 * Close and reset all cached database instances (for testing).
 */
export function resetDb(): void {
  for (const db of _dbs.values()) {
    db.close();
  }
  _dbs.clear();
}

/**
 * Run basic schema migration.
 * Creates common tables if they don't exist.
 * Actual migration logic will be added by migration tasks in Plan 2+.
 */
export function migrate(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);
}
