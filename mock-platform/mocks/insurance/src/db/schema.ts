import { getDb, type SqliteOptions } from "mock-lib";
import type { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface InsuranceDbOptions {
  dbPath?: string;
}

export function getInsuranceDb(options?: InsuranceDbOptions): Database {
  const path =
    options?.dbPath ??
    process.env.INSURANCE_DB_PATH ??
    "/var/lib/mock-data/insurance/insurance.db";
  if (path !== ":memory:") {
    try {
      mkdirSync(dirname(path), { recursive: true });
    } catch {
      // Directory not writable (e.g. host machine without /var/lib/mock-data).
      // Fall back to in-memory so OpenAPI generation and tests still work.
      return getDb({
        path: ":memory:",
        autoMigrate: true,
      } as SqliteOptions);
    }
  }
  return getDb({
    path,
    autoMigrate: true,
  } as SqliteOptions);
}

/**
 * Reverse-dependency drop order. With PRAGMA foreign_keys = ON, DROP TABLE
 * fails on tables still referenced by another table's FOREIGN KEY clause,
 * so children must be dropped before parents.
 */
const DROP_ORDER = [
  "plan_selection",
  "current_policy",
  "plan_benefit",
  "insurance_plan",
  "appointment",
  "appointment_slot",
  "provider_service",
  "provider",
  "claim_attachment",
  "claim_line_item",
  "claim",
  "users",
] as const;

export function resetInsuranceDb(db: Database): void {
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

  // ─── User ───────────────────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

  // ─── Claims domain ──────────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS claim (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      claim_type TEXT NOT NULL,
      total_amount INTEGER NOT NULL,
      service_date TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      check_item TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_claim_user ON claim(user_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS claim_line_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claim_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (claim_id) REFERENCES claim(id) ON DELETE CASCADE
    )
  `);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_claim_line_item_claim ON claim_line_item(claim_id)`,
  );

  db.run(`
    CREATE TABLE IF NOT EXISTS claim_attachment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claim_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (claim_id) REFERENCES claim(id) ON DELETE CASCADE
    )
  `);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_claim_attachment_claim ON claim_attachment(claim_id)`,
  );

  // ─── Appointment domain ─────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS provider (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      district TEXT NOT NULL,
      distance_km REAL NOT NULL,
      network_status TEXT NOT NULL DEFAULT 'in_network',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS provider_service (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL,
      check_item TEXT NOT NULL,
      service_name TEXT NOT NULL,
      cost INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (provider_id) REFERENCES provider(id) ON DELETE CASCADE,
      UNIQUE(provider_id, check_item)
    )
  `);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_provider_service_provider ON provider_service(provider_id)`,
  );

  db.run(`
    CREATE TABLE IF NOT EXISTS appointment_slot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_service_id INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_available INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (provider_service_id) REFERENCES provider_service(id) ON DELETE RESTRICT
    )
  `);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_appointment_slot_service ON appointment_slot(provider_service_id)`,
  );

  db.run(`
    CREATE TABLE IF NOT EXISTS appointment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider_id INTEGER NOT NULL,
      slot_id INTEGER NOT NULL,
      provider_name TEXT NOT NULL,
      service_name_snapshot TEXT NOT NULL,
      check_item TEXT NOT NULL,
      slot_start_time TEXT NOT NULL,
      slot_end_time TEXT NOT NULL,
      cost_snapshot INTEGER NOT NULL,
      distance_km_snapshot REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (provider_id) REFERENCES provider(id) ON DELETE RESTRICT,
      FOREIGN KEY (slot_id) REFERENCES appointment_slot(id) ON DELETE RESTRICT
    )
  `);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_appointment_user ON appointment(user_id)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_appointment_slot ON appointment(slot_id)`,
  );

  // ─── Plan domain ────────────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS insurance_plan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      effective_year INTEGER NOT NULL,
      premium_monthly INTEGER NOT NULL,
      deductible INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(code, effective_year)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS plan_benefit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      benefit_category TEXT NOT NULL,
      coverage_type TEXT NOT NULL,
      coverage_value INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (plan_id) REFERENCES insurance_plan(id) ON DELETE CASCADE
    )
  `);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_plan_benefit_plan ON plan_benefit(plan_id)`,
  );

  db.run(`
    CREATE TABLE IF NOT EXISTS current_policy (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (plan_id) REFERENCES insurance_plan(id)
    )
  `);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_current_policy_user ON current_policy(user_id)`,
  );
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_current_policy_active ON current_policy(user_id) WHERE status = 'active'`,
  );

  db.run(`
    CREATE TABLE IF NOT EXISTS plan_selection (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      plan_code_snapshot TEXT NOT NULL,
      plan_name_snapshot TEXT NOT NULL,
      deductible_snapshot INTEGER NOT NULL,
      premium_snapshot INTEGER NOT NULL,
      selected_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (plan_id) REFERENCES insurance_plan(id) ON DELETE RESTRICT
    )
  `);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_plan_selection_user ON plan_selection(user_id)`,
  );

  console.log("insurance: schema initialized with WAL mode");
}
