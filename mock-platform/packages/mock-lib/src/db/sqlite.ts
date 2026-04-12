import { Database } from "bun:sqlite";

/**
 * SQLite database singleton per mock binary.
 *
 * Each mock gets its own database instance. The database file path
 * is determined by the mock name and data directory configuration.
 */

let _db: Database | null = null;

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
 * Get or create the SQLite database singleton.
 *
 * In production: uses the configured file path.
 * In tests: defaults to :memory: for isolation.
 */
export function getDb(options?: SqliteOptions): Database {
  if (_db !== null) return _db;

  const opts = { ...DEFAULT_OPTIONS, ...options };
  _db = new Database(opts.path, { create: true });

  // Enable WAL mode for better concurrent read performance
  _db.run("PRAGMA journal_mode = WAL");
  _db.run("PRAGMA foreign_keys = ON");

  return _db;
}

/**
 * Close and reset the database singleton (for testing).
 */
export function resetDb(): void {
  if (_db !== null) {
    _db.close();
    _db = null;
  }
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
