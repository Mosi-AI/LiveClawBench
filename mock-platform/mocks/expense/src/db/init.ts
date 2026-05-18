import { getDb, resetDb, migrate } from "mock-lib";

const MIGRATIONS: Array<{ name: string; sql: string }> = [
  {
    name: "001_create_user",
    sql: `
      CREATE TABLE IF NOT EXISTS user (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        department TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('employee', 'manager', 'admin')) DEFAULT 'employee',
        preferred_currency TEXT NOT NULL CHECK(preferred_currency IN ('USD', 'CNY', 'EUR', 'GBP', 'JPY')) DEFAULT 'USD',
        avatar_url TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_login_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_user_email ON user(email);
    `,
  },
  {
    name: "002_create_expense_draft",
    sql: `
      CREATE TABLE IF NOT EXISTS expense_draft (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        draft_code TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        vendor_name TEXT NOT NULL,
        category TEXT CHECK(category IN ('travel', 'meals', 'office_supplies', 'software', 'lodging', 'transport', 'other')),
        amount REAL NOT NULL,
        currency TEXT NOT NULL CHECK(currency IN ('USD', 'CNY', 'EUR', 'GBP', 'JPY')) DEFAULT 'USD',
        invoice_date TEXT NOT NULL,
        expense_date TEXT,
        notes TEXT,
        source_type TEXT NOT NULL CHECK(source_type IN ('manual', 'email', 'imported')) DEFAULT 'manual',
        status TEXT NOT NULL CHECK(status IN ('draft', 'submitted', 'approved', 'rejected', 'reimbursed')) DEFAULT 'draft',
        attachment_ref TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        submitted_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_draft_user_id ON expense_draft(user_id);
      CREATE INDEX IF NOT EXISTS idx_draft_status ON expense_draft(status);
      CREATE INDEX IF NOT EXISTS idx_draft_code ON expense_draft(draft_code);
      CREATE INDEX IF NOT EXISTS idx_draft_attachment_ref ON expense_draft(attachment_ref);
    `,
  },
  {
    name: "003_create_expense_activity",
    sql: `
      CREATE TABLE IF NOT EXISTS expense_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        draft_id INTEGER NOT NULL REFERENCES expense_draft(id) ON DELETE CASCADE,
        actor_user_id INTEGER REFERENCES user(id) ON DELETE SET NULL,
        action_type TEXT NOT NULL CHECK(action_type IN ('created', 'edited', 'attachment_added', 'submitted', 'status_changed')),
        field_name TEXT,
        old_value TEXT,
        new_value TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_activity_draft_id ON expense_activity(draft_id);
      CREATE INDEX IF NOT EXISTS idx_activity_created_at ON expense_activity(created_at);
    `,
  },
  {
    name: "004_create_expense_attachment",
    sql: `
      CREATE TABLE IF NOT EXISTS expense_attachment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        draft_id INTEGER NOT NULL REFERENCES expense_draft(id) ON DELETE CASCADE,
        attachment_ref TEXT NOT NULL UNIQUE,
        original_filename TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        mime_type TEXT NOT NULL CHECK(mime_type IN ('application/pdf', 'image/png', 'image/jpeg', 'text/plain', 'text/html', 'text/csv')),
        file_size_bytes INTEGER NOT NULL DEFAULT 0,
        page_count INTEGER,
        preview_text TEXT,
        extracted_vendor_name TEXT,
        extracted_amount REAL,
        extracted_currency TEXT CHECK(extracted_currency IN ('USD', 'CNY', 'EUR', 'GBP', 'JPY')),
        extracted_invoice_date TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_attachment_draft_id ON expense_attachment(draft_id);
      CREATE INDEX IF NOT EXISTS idx_attachment_ref ON expense_attachment(attachment_ref);
    `,
  },
];

export function runMigrations(): void {
  const db = getDb({ path: process.env.EXPENSE_MOCK_DB_PATH || ":memory:", autoMigrate: false });
  migrate(db);
  for (const m of MIGRATIONS) {
    const row = db.query("SELECT 1 FROM _migrations WHERE name = ?").get(m.name) as unknown;
    if (!row) {
      db.exec(m.sql);
      db.exec("INSERT INTO _migrations (name) VALUES (?)", [m.name]);
    }
  }
}

export { getDb, resetDb };
