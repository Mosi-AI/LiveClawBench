import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import type { CoffeeSchedule, ThermostatMode, WorkoutType } from "./types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Data directory for persistent smarthome state. The per-task startup script creates this
// directory (mkdir -p, chown mock:mock, chmod 700) and creates verifier-compatible
// symlink: /tmp/mosi_smart_home.sqlite -> /var/lib/mock-data/smarthome/smarthome.db
export function getDataDir(): string {
  return process.env.MOCK_DATA_DIR || "/var/lib/mock-data/smarthome";
}

export function getDbPath(): string {
  return `${getDataDir()}/smarthome.db`;
}

export function getSeedPath(): string {
  return process.env.MOCK_SEED_PATH || "/opt/mock/data/smarthome.sql";
}

let db: Database | null = null;

// ---------------------------------------------------------------------------
// Database initialization
// ---------------------------------------------------------------------------

type CoffeeScheduleRow = {
  schedule_date: string;
  start_time: string;
  beans_grams: number;
  cancelled: number;
  updated_at: string;
};

function getBenchmarkDateFromDatabase(database: Database): string {
  const clock = database.query("SELECT clock_time FROM benchmark_clock WHERE id = 1").get() as { clock_time: string } | null;
  return clock?.clock_time.split("T")[0] || "2026-05-06";
}

function migrateLegacyCoffeeSchedule(database: Database): void {
  const coffeeTable = database.query("PRAGMA table_info(coffee_schedule)").all() as { name: string }[];
  if (coffeeTable.length === 0 || coffeeTable.some((column) => column.name === "schedule_date")) {
    return;
  }

  const legacyRows = database.query("SELECT start_time, COALESCE(beans_grams, 20) AS beans_grams, COALESCE(cancelled, 0) AS cancelled, updated_at FROM coffee_schedule").all() as {
    start_time: string;
    beans_grams: number;
    cancelled: number;
    updated_at: string | null;
  }[];
  const fallbackDate = getBenchmarkDateFromDatabase(database);

  database.exec(`
    ALTER TABLE coffee_schedule RENAME TO coffee_schedule_legacy;
    CREATE TABLE coffee_schedule (
      schedule_date TEXT PRIMARY KEY,
      start_time TEXT NOT NULL,
      beans_grams INTEGER DEFAULT 20,
      cancelled INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);

  const insertRow = database.query("INSERT OR REPLACE INTO coffee_schedule (schedule_date, start_time, beans_grams, cancelled, updated_at) VALUES (?, ?, ?, ?, ?)");
  for (const row of legacyRows) {
    const scheduleDate = row.updated_at?.split("T")[0] || fallbackDate;
    insertRow.run(scheduleDate, row.start_time, row.beans_grams, row.cancelled, row.updated_at || `${scheduleDate}T00:00:00Z`);
  }

  database.exec("DROP TABLE coffee_schedule_legacy");
}

// Check if required singleton tables have seed data (thermostat, coffee, benchmark_clock)
function hasRequiredSeedData(): boolean {
  if (!db) return false;
  try {
    const thermostat = db.query("SELECT id FROM thermostat_settings WHERE id = 1").get();
    const coffee = db.query("SELECT schedule_date FROM coffee_schedule LIMIT 1").get();
    const clock = db.query("SELECT id FROM benchmark_clock WHERE id = 1").get();
    return thermostat !== null && coffee !== null && clock !== null;
  } catch (err) {
    console.error("mock-smarthome: WARNING: database error checking seed data, will re-seed:", err);
    return false;
  }
}

export function initDatabase(): void {
  const dbPath = getDbPath();
  const seedPath = getSeedPath();
  const dbDir = dbPath.substring(0, dbPath.lastIndexOf("/"));
  try {
    mkdirSync(dbDir, { recursive: true });
  } catch (err) {
    console.error(`mock-smarthome: FATAL: cannot create database directory: ${dbDir}`, err);
    process.exit(1);
  }

  // Check if DB already exists (for persistence across restart)
  const dbExists = existsSync(dbPath);
  db = new Database(dbPath, { create: true });

  // Create tables with CHECK constraints (idempotent via IF NOT EXISTS)
  db.exec(`
    -- Thermostat settings (singleton)
    CREATE TABLE IF NOT EXISTS thermostat_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      mode TEXT NOT NULL CHECK (mode IN ('comfort', 'eco', 'off')),
      temperature REAL NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Coffee schedule (per date)
    CREATE TABLE IF NOT EXISTS coffee_schedule (
      schedule_date TEXT PRIMARY KEY,
      start_time TEXT NOT NULL,
      beans_grams INTEGER DEFAULT 20,
      cancelled INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    -- Benchmark clock for deterministic time-based status
    CREATE TABLE IF NOT EXISTS benchmark_clock (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      clock_time TEXT NOT NULL
    );

    -- Room metrics
    CREATE TABLE IF NOT EXISTS room_metrics (
      id INTEGER PRIMARY KEY,
      temperature REAL NOT NULL,
      humidity REAL NOT NULL,
      unit_temp TEXT NOT NULL,
      noise REAL,
      light REAL,
      air_quality REAL
    );

    -- Room info
    CREATE TABLE IF NOT EXISTS room (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );

    -- Inventory items
    CREATE TABLE IF NOT EXISTS inventory_item (
      id INTEGER PRIMARY KEY,
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      location TEXT NOT NULL,
      expiry_date TEXT,
      category TEXT,
      updated_at TEXT
    );

    -- Inventory snapshot (captured at startup)
    CREATE TABLE IF NOT EXISTS inventory_snapshot (
      id INTEGER PRIMARY KEY,
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      location TEXT,
      captured_at TEXT NOT NULL
    );

    -- Grocery products (internal catalog)
    CREATE TABLE IF NOT EXISTS grocery_product (
      product_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      stock_status TEXT NOT NULL CHECK (stock_status IN ('sufficient', 'insufficient', 'unavailable')),
      substitute_for TEXT,
      reference TEXT
    );

    -- Wearable/recovery state
    CREATE TABLE IF NOT EXISTS wearable_recovery_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      sleep_hours REAL NOT NULL,
      sleep_score REAL NOT NULL,
      readiness REAL NOT NULL,
      resting_heart_rate REAL NOT NULL
    );

    -- Calendar events
    CREATE TABLE IF NOT EXISTS calendar_event (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      event_type TEXT,
      workout_type TEXT CHECK (workout_type IN ('hiit', 'yoga', 'walking', 'cycling', 'strength', 'swimming', 'rest') OR workout_type IS NULL),
      status TEXT NOT NULL DEFAULT 'undone' CHECK (status IN ('done', 'undone')),
      updated_at TEXT NOT NULL
    );

    -- User constraints
    CREATE TABLE IF NOT EXISTS user_constraints (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      calorie_target REAL NOT NULL,
      macro_targets TEXT NOT NULL,
      allergy_constraints TEXT NOT NULL,
      weekly_budget_limit REAL NOT NULL
    );

    -- Recipes
    CREATE TABLE IF NOT EXISTS recipe (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
      ingredients TEXT NOT NULL,
      calories_total REAL NOT NULL,
      allergens TEXT
    );

    -- Recipe nutrition (per-ingredient breakdown)
    CREATE TABLE IF NOT EXISTS recipe_nutrition (
      id INTEGER PRIMARY KEY,
      meal_id INTEGER NOT NULL,
      ingredient_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      calories REAL NOT NULL,
      protein_g REAL,
      carbs_g REAL,
      fat_g REAL,
      FOREIGN KEY (meal_id) REFERENCES recipe(id)
    );

    -- Meal plans
    CREATE TABLE IF NOT EXISTS meal_plan (
      id INTEGER PRIMARY KEY,
      plan_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      plan_data TEXT NOT NULL
    );

    -- Substitution mapping
    CREATE TABLE IF NOT EXISTS substitution_mapping (
      id INTEGER PRIMARY KEY,
      original_item TEXT NOT NULL,
      substitute_item TEXT NOT NULL,
      substitution_ratio REAL NOT NULL,
      category TEXT
    );
  `);

  migrateLegacyCoffeeSchedule(db);

  // Load seed SQL if:
  // 1. Fresh DB (doesn't exist yet), OR
  // 2. Existing DB but required singleton tables are empty (handles restart after crash before seed)
  const needsSeed = !dbExists || !hasRequiredSeedData();
  if (needsSeed && existsSync(seedPath)) {
    const sql = readFileSync(seedPath, "utf-8");
    db.exec(sql);
    console.log(`mock-smarthome: initialized DB from ${seedPath} (${dbExists ? "refilled empty tables" : "fresh DB"})`);
  } else if (dbExists) {
    console.log(`mock-smarthome: found existing DB at ${dbPath} with valid seed data, preserving state`);
  } else {
    console.log(`mock-smarthome: no seed SQL found at ${seedPath}, using empty tables`);
  }

  // Populate inventory_snapshot from inventory_item (only if snapshot is empty)
  populateInventorySnapshot();
}

function populateInventorySnapshot(): void {
  const database = assertDb();

  // Check if snapshot already exists
  const existing = database.query("SELECT COUNT(*) as count FROM inventory_snapshot").get() as { count: number };
  if (existing.count > 0) {
    return;
  }

  // Use benchmark_clock for deterministic captured_at, fallback to seed time if not set
  const clock = database.query("SELECT clock_time FROM benchmark_clock WHERE id = 1").get() as { clock_time: string } | null;
  const capturedAt = clock?.clock_time || "2026-05-06T08:00:00Z";

  // Copy inventory items to snapshot
  database.exec(`
    INSERT INTO inventory_snapshot (item_name, quantity, unit, location, captured_at)
    SELECT item_name, quantity, unit, location, '${capturedAt}'
    FROM inventory_item
  `);
  console.log("mock-smarthome: populated inventory_snapshot from inventory_item");
}

export function assertDb(): Database {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function isValidThermostatMode(mode: string): mode is ThermostatMode {
  return ["comfort", "eco", "off"].includes(mode.toLowerCase());
}

export function isValidWorkoutType(type: string): type is WorkoutType {
  return ["hiit", "yoga", "walking", "cycling", "strength", "swimming", "rest"].includes(type.toLowerCase());
}

// Get deterministic timestamp from benchmark_clock (required for benchmark-verifiable state)
export function getBenchmarkTime(): string {
  const database = assertDb();
  const clock = database.query("SELECT clock_time FROM benchmark_clock WHERE id = 1").get() as { clock_time: string } | null;
  if (!clock) {
    console.error("mock-smarthome: WARNING: benchmark_clock row missing, falling back to default time 2026-05-06T08:00:00Z");
    return "2026-05-06T08:00:00Z";
  }
  return clock.clock_time;
}

export function getBenchmarkDate(): string {
  return getBenchmarkTime().split("T")[0];
}

export function isValidIsoDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === date;
}

export function canEditCoffeeDate(scheduleDate: string): boolean {
  return scheduleDate >= getBenchmarkDate();
}

export function getCoffeeScheduleForDate(scheduleDate: string): CoffeeSchedule {
  const database = assertDb();
  const row = database.query("SELECT schedule_date, start_time, beans_grams, cancelled, updated_at FROM coffee_schedule WHERE schedule_date = ?").get(scheduleDate) as CoffeeScheduleRow | null;
  if (!row) {
    return {
      schedule_date: scheduleDate,
      start_time: null,
      status: "unset",
      beans_grams: null,
      cancelled: false,
      updated_at: null,
      has_schedule: false,
    };
  }

  return {
    schedule_date: row.schedule_date,
    start_time: row.start_time,
    status: row.cancelled === 1 ? "cancelled" : deriveCoffeeStatus(row.schedule_date, row.start_time, getBenchmarkTime()),
    beans_grams: row.beans_grams,
    cancelled: row.cancelled === 1,
    updated_at: row.updated_at,
    has_schedule: true,
  };
}

// Derive coffee status from the schedule date/start_time and benchmark clock in a timezone-stable way
export function deriveCoffeeStatus(scheduleDate: string, startTime: string, currentTime: string): string {
  const currentDate = currentTime.split("T")[0];
  if (currentDate < scheduleDate) {
    return "scheduled";
  }
  if (currentDate > scheduleDate) {
    return "ready";
  }

  // Parse HH:MM start time
  const [startHour, startMin] = startTime.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;

  // Parse ISO 8601 current time in a timezone-stable way (use UTC)
  // Format: 2026-05-06T06:45:00Z
  const timeMatch = currentTime.match(/T(\d{2}):(\d{2}):/);
  if (!timeMatch) {
    console.warn(`mock-smarthome: WARNING: invalid time format "${currentTime}", falling back to "scheduled"`);
    return "scheduled"; // Fallback if time format is invalid
  }
  const currentHour = parseInt(timeMatch[1], 10);
  const currentMin = parseInt(timeMatch[2], 10);
  const currentMinutes = currentHour * 60 + currentMin;

  if (currentMinutes < startMinutes - 30) {
    return "scheduled";
  } else if (currentMinutes < startMinutes) {
    return "preparing";
  } else if (currentMinutes < startMinutes + 30) {
    return "brewing";
  } else {
    return "ready";
  }
}

// Generate deterministic plan ID based on benchmark clock and database state
export function generatePlanId(): string {
  const database = assertDb();
  const time = getBenchmarkTime();
  const timestamp = time.replace(/[-:T]/g, "").substring(0, 14);

  // Query existing plans with same timestamp prefix to get next suffix
  const prefix = `PLAN${timestamp}-`;
  const existing = database.query("SELECT plan_id FROM meal_plan WHERE plan_id LIKE ? ORDER BY plan_id DESC LIMIT 1").all(`${prefix}%`) as { plan_id: string }[];
  let nextSuffix = 1;
  if (existing.length > 0) {
    const lastSuffix = existing[0].plan_id.substring(prefix.length);
    const parsed = parseInt(lastSuffix, 36);
    if (isNaN(parsed)) {
      console.error(`mock-smarthome: WARNING: malformed plan_id "${existing[0].plan_id}", resetting suffix to 1`);
    } else {
      nextSuffix = parsed + 1;
    }
  }

  return `PLAN${timestamp}-${nextSuffix.toString(36).toUpperCase().padStart(3, "0")}`;
}
