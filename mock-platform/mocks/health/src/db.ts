import { getDb } from "mock-lib";
import type { Database } from "bun:sqlite";

export function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mock_user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS health_daily_snapshot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      date TEXT NOT NULL,
      steps INTEGER,
      active_energy_kcal REAL,
      sleep_hours REAL,
      sleep_quality REAL,
      light_sleep_hours REAL,
      deep_sleep_hours REAL,
      rem_sleep_hours REAL,
      low_intensity_min REAL,
      medium_intensity_min REAL,
      high_intensity_min REAL,
      total_activity_min REAL,
      resting_heart_rate_bpm INTEGER,
      avg_heart_rate_bpm INTEGER,
      weight_kg REAL,
      body_fat_percent REAL,
      blood_oxygen_percent REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, date),
      FOREIGN KEY (user_id) REFERENCES mock_user(id)
    );

    CREATE TABLE IF NOT EXISTS health_metric_series (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      metric_type TEXT NOT NULL,
      date TEXT NOT NULL,
      value REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, metric_type, date),
      FOREIGN KEY (user_id) REFERENCES mock_user(id)
    );

    CREATE TABLE IF NOT EXISTS allergen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      severity TEXT,
      notes TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES mock_user(id)
    );

    CREATE TABLE IF NOT EXISTS medication (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      display_name TEXT,
      frequency TEXT NOT NULL DEFAULT 'daily',
      dose_amount REAL,
      dose_unit TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      notes TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES mock_user(id)
    );

    CREATE TABLE IF NOT EXISTS medication_intake_slot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medication_id INTEGER NOT NULL,
      time_hhmm TEXT NOT NULL,
      dose_amount REAL,
      dose_unit TEXT,
      label TEXT,
      FOREIGN KEY (medication_id) REFERENCES medication(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS medication_dose_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medication_id INTEGER NOT NULL,
      slot_id INTEGER,
      logged_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'taken',
      log_dose_amount REAL,
      log_dose_unit TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (medication_id) REFERENCES medication(id) ON DELETE CASCADE,
      FOREIGN KEY (slot_id) REFERENCES medication_intake_slot(id)
    );

    CREATE INDEX IF NOT EXISTS idx_snapshot_user_date ON health_daily_snapshot(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_metric_user_type_date ON health_metric_series(user_id, metric_type, date);
    CREATE INDEX IF NOT EXISTS idx_allergen_user ON allergen(user_id, archived);
    CREATE INDEX IF NOT EXISTS idx_medication_user ON medication(user_id, archived);
    CREATE INDEX IF NOT EXISTS idx_slot_medication ON medication_intake_slot(medication_id);
    CREATE INDEX IF NOT EXISTS idx_dose_log_medication ON medication_dose_log(medication_id, logged_at);

    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Add new columns to existing databases that predate this schema
  for (const col of [
    "light_sleep_hours REAL", "deep_sleep_hours REAL", "rem_sleep_hours REAL",
    "low_intensity_min REAL", "medium_intensity_min REAL", "high_intensity_min REAL",
    "total_activity_min REAL",
  ]) {
    try { db.exec(`ALTER TABLE health_daily_snapshot ADD COLUMN ${col}`); } catch (_) {}
  }
}

let _lastDb: Database | null = null;

export function initDb(): Database {
  const db = getDb({ path: "health.db", autoMigrate: true });
  if (db !== _lastDb) {
    runMigrations(db);
    db.exec(`INSERT OR IGNORE INTO mock_user (id, username, display_name) VALUES (1, 'default', 'Health User')`);
    db.exec(`INSERT OR IGNORE INTO system_config (key, value) VALUES ('current_date', '2026-05-13')`);
    db.exec(`INSERT OR IGNORE INTO system_config (key, value) VALUES ('current_time', '16:42')`);
    _lastDb = db;
  }
  return db;
}
