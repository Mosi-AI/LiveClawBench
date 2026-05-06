import { Database } from "bun:sqlite";
import { getDb, resetDb } from "mock-lib";

const DEFAULT_DB_PATH = ":memory:";

export function getEmailDb(options?: { path?: string }): Database {
  const path = options?.path ?? process.env.EMAIL_DB_PATH ?? DEFAULT_DB_PATH;
  // Bypass the process-level singleton for in-memory DBs so that
  // spec-generation (which instantiates multiple mocks in one process)
  // and tests each get a fresh database.
  if (path === ":memory:") {
    return new Database(":memory:", { create: true });
  }
  return getDb({ path });
}

export function resetEmailDb(): void {
  // Resets the process-level singleton (file-backed DBs only).
  // In-memory DBs bypass the singleton, so this is a no-op in tests.
  resetDb();
}

export function initSchema(db: Database): void {
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA synchronous = NORMAL;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      recipient_id INTEGER,
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      folder TEXT NOT NULL DEFAULT 'inbox',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id INTEGER,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_emails_sender_folder ON emails(sender_id, folder);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_emails_recipient_folder ON emails(recipient_id, folder);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_attachments_email ON attachments(email_id);
  `);
}
