import { Database } from "bun:sqlite";

/**
 * SQLite database singleton per mock binary.
 *
 * Each mock gets its own database instance. The database file path
 * is determined by mock name and data directory configuration.
 *
 * API Constraint: This module implements a process-level singleton. Calling getDb()
 * with different paths in the same process returns the first instance. This is safe
 * in the current architecture where each mock runs in its own isolated process,
 * but callers should be aware of this behavior for future multi-DB use cases.
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
 *
 * Note: This returns a process-level singleton. For multi-DB scenarios,
 * consider migrating to a path-isolated Map-based design.
 */
export function getDb(options?: SqliteOptions): Database {
  if (_db !== null) return _db;

  const opts = { ...DEFAULT_OPTIONS, ...options };
  _db = new Database(opts.path, { create: true });

  // Enable WAL mode for better concurrent read performance
  _db.run("PRAGMA journal_mode = WAL");
  _db.run("PRAGMA foreign_keys = ON");

  // Run migrations if autoMigrate is enabled (default behavior)
  if (opts.autoMigrate) {
    migrate(_db);
  }

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
function migrate(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);
}
