/**
 * Smart Home mock service — 8-domain home automation mock
 *
 * Provides deterministic mock APIs for:
 * - Room Metrics (read-only)
 * - Thermostat (GET/POST)
 * - Coffee Schedule (GET/POST with derived status)
 * - Inventory (GET/POST/DELETE)
 * - Shopping List (GET/POST/PUT/DELETE products)
 * - Wearable/Recovery (read-only)
 * - Calendar/Workout (GET/PUT with workout_type enum)
 * - Meal Planning (GET constraints/recipes, POST/GET meal-plan)
 *
 * Uses SQLite for persistence with verifier-readable symlink.
 */

import { createMockApp, startServer } from "mock-lib";
import type { AppEnv, OpenAPIApp } from "mock-lib";
import { html, raw } from "hono/html";
import type { FC, Child } from "hono/jsx";
import { Database } from "bun:sqlite";
import { mkdirSync, existsSync, readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Room Metrics
interface RoomMetrics {
  temperature: number;
  humidity: number;
  unit_temp: string;
  noise?: number;
  light?: number;
  air_quality?: number;
}

// Thermostat
type ThermostatMode = "comfort" | "eco" | "off";

interface ThermostatSettings {
  id: number;
  mode: ThermostatMode;
  temperature: number;
  updated_at: string;
}

// Coffee Schedule
interface CoffeeSchedule {
  id: number;
  start_time: string;
  updated_at: string;
}

// Inventory
interface InventoryItem {
  id: number;
  item_name: string;
  quantity: number;
  unit: string;
  location: string;
  expiry_date?: string;
  category?: string;
}

// Grocery
interface GroceryProduct {
  product_id: string;
  name: string;
  quantity: number;
  unit: string;
  stock_status: "sufficient" | "insufficient" | "unavailable";
  substitute_for?: string;
  reference?: string; // Optional order_id from shop mock
}

// Wearable/Recovery
interface WearableRecovery {
  sleep_hours: number;
  sleep_score: number;
  readiness: number;
  resting_heart_rate: number;
}

// Calendar/Workout
type WorkoutType = "hiit" | "yoga" | "walking" | "cycling" | "strength" | "stretching" | "swimming" | "rest";

interface CalendarEvent {
  id: number;
  title: string;
  start_time: string;
  event_type?: string;
  workout_type?: WorkoutType;
  updated_at: string;
}

// Meal Planning
interface UserConstraints {
  calorie_target: number;
  macro_targets: string;
  allergy_constraints: string;
  weekly_budget_limit: number;
}

interface Recipe {
  id: number;
  name: string;
  meal_type: "breakfast" | "lunch" | "dinner";
  ingredients: string;
  calories_total: number;
  allergens?: string;
}

interface MealPlan {
  id: number;
  plan_id: string;
  created_at: string;
  plan_data: string;
}

// Benchmark Clock
interface BenchmarkClock {
  id: number;
  current_time: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Data directory for persistent smarthome state. The per-task startup script creates this
// directory (mkdir -p, chown mock:mock, chmod 700) and creates verifier-compatible
// symlink: /tmp/mosi_smart_home.sqlite -> /var/lib/mock-data/smarthome/smarthome.db
const DATA_DIR = process.env.MOCK_DATA_DIR || "/var/lib/mock-data/smarthome";
const DB_PATH = `${DATA_DIR}/smarthome.db`;
const SEED_PATH = process.env.MOCK_SEED_PATH || "/opt/mock/data/smarthome.sql";

let db: Database | null = null;

// ---------------------------------------------------------------------------
// Database initialization
// ---------------------------------------------------------------------------

// Check if required singleton tables have seed data (thermostat, coffee, benchmark_clock)
function hasRequiredSeedData(): boolean {
  if (!db) return false;
  try {
    const thermostat = db.query("SELECT id FROM thermostat_settings WHERE id = 1").get();
    const coffee = db.query("SELECT id FROM coffee_schedule WHERE id = 1").get();
    const clock = db.query("SELECT id FROM benchmark_clock WHERE id = 1").get();
    return thermostat !== null && coffee !== null && clock !== null;
  } catch (err) {
    console.error("mock-smarthome: WARNING: database error checking seed data, will re-seed:", err);
    return false;
  }
}

function initDatabase(): void {
  const dbDir = DB_PATH.substring(0, DB_PATH.lastIndexOf("/"));
  try {
    mkdirSync(dbDir, { recursive: true });
  } catch (err) {
    console.error(`mock-smarthome: FATAL: cannot create database directory: ${dbDir}`, err);
    process.exit(1);
  }

  // Check if DB already exists (for persistence across restart)
  const dbExists = existsSync(DB_PATH);
  db = new Database(DB_PATH, { create: true });

  // Create tables with CHECK constraints (idempotent via IF NOT EXISTS)
  db.exec(`
    -- Thermostat settings (singleton)
    CREATE TABLE IF NOT EXISTS thermostat_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      mode TEXT NOT NULL CHECK (mode IN ('comfort', 'eco', 'off')),
      temperature REAL NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Coffee schedule (singleton)
    CREATE TABLE IF NOT EXISTS coffee_schedule (
      id INTEGER PRIMARY KEY CHECK (id = 1),
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
      workout_type TEXT CHECK (workout_type IN ('hiit', 'yoga', 'walking', 'cycling', 'strength', 'stretching', 'swimming', 'rest') OR workout_type IS NULL),
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

  // Load seed SQL if:
  // 1. Fresh DB (doesn't exist yet), OR
  // 2. Existing DB but required singleton tables are empty (handles restart after crash before seed)
  const needsSeed = !dbExists || !hasRequiredSeedData();
  if (needsSeed && existsSync(SEED_PATH)) {
    const sql = readFileSync(SEED_PATH, "utf-8");
    db.exec(sql);
    console.log(`mock-smarthome: initialized DB from ${SEED_PATH} (${dbExists ? "refilled empty tables" : "fresh DB"})`);
  } else if (dbExists) {
    console.log(`mock-smarthome: found existing DB at ${DB_PATH} with valid seed data, preserving state`);
  } else {
    console.log(`mock-smarthome: no seed SQL found at ${SEED_PATH}, using empty tables`);
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

function assertDb(): Database {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function isValidThermostatMode(mode: string): mode is ThermostatMode {
  return ["comfort", "eco", "off"].includes(mode.toLowerCase());
}

function isValidWorkoutType(type: string): type is WorkoutType {
  return ["hiit", "yoga", "walking", "cycling", "strength", "stretching", "swimming", "rest"].includes(type.toLowerCase());
}

// Get deterministic timestamp from benchmark_clock (required for benchmark-verifiable state)
function getBenchmarkTime(): string {
  const database = assertDb();
  const clock = database.query("SELECT clock_time FROM benchmark_clock WHERE id = 1").get() as { clock_time: string } | null;
  if (!clock) {
    console.error("mock-smarthome: WARNING: benchmark_clock row missing, falling back to default time 2026-05-06T08:00:00Z");
    return "2026-05-06T08:00:00Z";
  }
  return clock.clock_time;
}

// Derive coffee status from start_time and benchmark_clock in a timezone-stable way
function deriveCoffeeStatus(startTime: string, currentTime: string): string {
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
function generatePlanId(): string {
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

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escJs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

// ---------------------------------------------------------------------------
// TSX Template Components
// ---------------------------------------------------------------------------

const Layout: FC<{ title: string; children: Child; scripts?: string }> = ({ title, children, scripts }) => {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
  .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
  h1 { color: #232F3E; margin-bottom: 20px; }
  h2 { color: #232F3E; margin-top: 30px; }
  .nav { display: flex; gap: 15px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e0e0e0; flex-wrap: wrap; }
  .nav a { color: #667eea; text-decoration: none; padding: 8px 16px; border-radius: 4px; background: #f8f9fa; }
  .nav a:hover { background: #667eea; color: white; }
  .card { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
  .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
  .metric:last-child { border-bottom: none; }
  .metric-label { color: #666; }
  .metric-value { font-weight: 600; color: #232F3E; }
  .btn { background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; }
  .btn:hover { background: #5a6fd6; }
  .btn-secondary { background: #6c757d; }
  .btn-danger { background: #dc3545; }
  input, select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; margin-right: 10px; }
  table { width: 100%; border-collapse: collapse; margin-top: 15px; }
  th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
  th { background: #f8f9fa; font-weight: 600; }
  .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
  .status-scheduled { background: #e3f2fd; color: #1976d2; }
  .status-brewing { background: #fff3e0; color: #f57c00; }
  .status-ready { background: #e8f5e9; color: #388e3c; }
</style>
</head>
<body>
<div class="container">
<nav class="nav">
<a href="/">Dashboard</a>
<a href="/thermostat">Thermostat</a>
<a href="/coffee">Coffee</a>
<a href="/inventory">Inventory</a>
<a href="/grocery">Shopping List</a>
<a href="/wearable">Wearable</a>
<a href="/calendar">Calendar</a>
<a href="/meal-plan">Meal Plan</a>
</nav>
${children}
</div>
${scripts ? html`<script>${raw(scripts)}</script>` : ""}
</body>
</html>`;
};

// Error page for 500 errors
const ErrorPage: FC<{ title: string; message: string }> = ({ title, message }) => {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f5f5f5; }
  .error-container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
  h1 { color: #dc3545; margin-bottom: 20px; }
  p { color: #666; line-height: 1.6; }
</style>
</head>
<body>
<div class="error-container">
<h1>${title}</h1>
<p>${message}</p>
</div>
</body>
</html>`;
};

// Coffee Schedule page
const CoffeePage: FC<{ schedule: { start_time: string; status: string; beans_grams: number; cancelled: boolean; updated_at: string } }> = ({ schedule }) => {
  const displayStartTime = schedule.cancelled ? "-" : schedule.start_time;
  const displayStatus = schedule.cancelled ? "-" : schedule.status.toUpperCase();
  const displayBeans = schedule.cancelled ? "-" : `${schedule.beans_grams}g`;
  const statusBadgeClass = schedule.cancelled ? "" : schedule.status === 'ready' ? 'status-ready' : schedule.status === 'brewing' ? 'status-brewing' : 'status-scheduled';

  return <Layout title="Coffee Schedule" scripts={`
async function updateSchedule() {
  const startTime = document.getElementById('start-time').value;
  const beansGrams = parseInt(document.getElementById('beans-grams').value) || 20;
  if (!startTime) { alert('Please enter a start time'); return; }
  if (beansGrams < 5 || beansGrams > 100) { alert('Beans amount must be between 5g and 100g'); return; }
  try {
    const response = await fetch('/api/coffee-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_time: startTime, beans_grams: beansGrams, cancelled: false })
    });
    const data = await response.json();
    if (data.error) alert('Error: ' + data.error);
    else location.reload();
  } catch (err) { alert('Failed to update schedule'); }
}

async function cancelSchedule() {
  if (!confirm('Are you sure you want to cancel the coffee schedule?')) return;
  try {
    const response = await fetch('/api/coffee-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancelled: true })
    });
    const data = await response.json();
    if (data.error) alert('Error: ' + data.error);
    else location.reload();
  } catch (err) { alert('Failed to cancel schedule'); }
}
`}>
    <h1>Coffee Schedule</h1>
    <div class="card">
      <div class="metric">
        <span class="metric-label">Start Time</span>
        <span class="metric-value">{displayStartTime}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Status</span>
        <span class="metric-value">
          <span class={`status-badge ${statusBadgeClass}`}>
            {displayStatus}
          </span>
        </span>
      </div>
      <div class="metric">
        <span class="metric-label">Beans</span>
        <span class="metric-value">{displayBeans}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Last Updated</span>
        <span class="metric-value">{schedule.updated_at}</span>
      </div>
    </div>

    <h2>Update Schedule</h2>
    <div class="card">
      <div style="margin-bottom:12px;">
        <label style="display:block; margin-bottom:4px; font-weight:500;">Start Time</label>
        <input type="time" id="start-time" value={schedule.start_time} style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block; margin-bottom:4px; font-weight:500;">Beans (grams)</label>
        <input type="number" id="beans-grams" value={schedule.beans_grams} min="5" max="100" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
      </div>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button class="btn btn-danger" onclick="cancelSchedule()">Cancel Schedule</button>
        <button class="btn" onclick="updateSchedule()">Update</button>
      </div>
    </div>

    <p style="color: #666; font-size: 14px; margin-top: 16px;">Brewing takes approximately 30 minutes.</p>
  </Layout>;
};

// Wearable/Recovery page
const WearablePage: FC<{ data: WearableRecovery }> = ({ data }) => {
  return <Layout title="Wearable & Recovery">
    <h1>Wearable & Recovery Data</h1>
    <div class="card">
      <div class="metric">
        <span class="metric-label">Sleep Hours</span>
        <span class="metric-value">{`${data.sleep_hours} hrs`}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Sleep Score</span>
        <span class="metric-value">{`${data.sleep_score}/100`}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Readiness</span>
        <span class="metric-value">{`${data.readiness}/100`}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Resting Heart Rate</span>
        <span class="metric-value">{`${data.resting_heart_rate} bpm`}</span>
      </div>
    </div>
    <p style="color: #666; font-size: 14px;">This data is read-only and synced from your wearable device.</p>
  </Layout>;
};

// Dashboard page
const DashboardPage: FC<{ metrics: RoomMetrics; thermostat: ThermostatSettings }> = ({ metrics, thermostat }) => {
  return <Layout title="Smart Home Dashboard">
    <h1>Smart Home Dashboard</h1>

    <h2>Room Metrics</h2>
    <div class="card">
      <div class="metric">
        <span class="metric-label">Temperature</span>
        <span class="metric-value">{`${metrics.temperature}°${metrics.unit_temp}`}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Humidity</span>
        <span class="metric-value">{`${metrics.humidity}%`}</span>
      </div>
      {metrics.noise != null ? (
        <div class="metric">
          <span class="metric-label">Noise Level</span>
          <span class="metric-value">{`${metrics.noise} dB`}</span>
        </div>
      ) : null}
      {metrics.light != null ? (
        <div class="metric">
          <span class="metric-label">Light</span>
          <span class="metric-value">{`${metrics.light} lux`}</span>
        </div>
      ) : null}
      {metrics.air_quality != null ? (
        <div class="metric">
          <span class="metric-label">Air Quality</span>
          <span class="metric-value">{metrics.air_quality}</span>
        </div>
      ) : null}
    </div>

    <h2>Thermostat</h2>
    <div class="card">
      <div class="metric">
        <span class="metric-label">Mode</span>
        <span class="metric-value">{thermostat.mode.toUpperCase()}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Target Temperature</span>
        <span class="metric-value">{`${thermostat.temperature}°F`}</span>
      </div>
    </div>
  </Layout>;
};

// Thermostat page
const ThermostatPage: FC<{ thermostat: ThermostatSettings }> = ({ thermostat }) => {
  return <Layout title="Thermostat Control" scripts={`
async function updateThermostat() {
  const mode = document.getElementById('mode').value;
  const temperature = parseFloat(document.getElementById('temperature').value);
  if (isNaN(temperature)) { alert('Please enter a valid temperature'); return; }
  try {
    const response = await fetch('/api/thermostat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, temperature })
    });
    const data = await response.json();
    if (data.error) { alert('Error: ' + data.error); }
    else { location.reload(); }
  } catch (err) { alert('Failed to update thermostat'); }
}
`}>
    <h1>Thermostat Control</h1>
    <div class="card">
      <div class="metric">
        <span class="metric-label">Current Mode</span>
        <span class="metric-value">{thermostat.mode.toUpperCase()}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Target Temperature</span>
        <span class="metric-value">{`${thermostat.temperature}°F`}</span>
      </div>
    </div>

    <h2>Update Settings</h2>
    <div class="card">
      <select id="mode">
        <option value="comfort" selected={thermostat.mode === "comfort"}>Comfort</option>
        <option value="eco" selected={thermostat.mode === "eco"}>Eco</option>
        <option value="off" selected={thermostat.mode === "off"}>Off</option>
      </select>
      <input type="number" id="temperature" value={thermostat.temperature} step="1" min="50" max="90" placeholder="Temperature (°F)" />
      <button class="btn" onclick="updateThermostat()">Update</button>
    </div>
  </Layout>;
};

// Inventory page
const InventoryPage: FC<{ items: InventoryItem[] }> = ({ items }) => {
  const fridgeItems = items.filter(i => i.location === "fridge");
  const pantryItems = items.filter(i => i.location === "pantry");

  return <Layout title="Inventory" scripts={`
let editingId = null;

function openAddModal(location) {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Add Item';
  document.getElementById('item-id').value = '';
  document.getElementById('item-name').value = '';
  document.getElementById('item-quantity').value = '';
  document.getElementById('item-unit').value = '';
  document.getElementById('item-location').value = location;
  document.getElementById('item-expiry').value = '';
  document.getElementById('item-category').value = '';
  document.getElementById('item-modal').style.display = 'block';
}

function openEditModal(id, name, quantity, unit, location, expiry, category) {
  editingId = id;
  document.getElementById('modal-title').textContent = 'Edit Item';
  document.getElementById('item-id').value = id;
  document.getElementById('item-name').value = name;
  document.getElementById('item-quantity').value = quantity;
  document.getElementById('item-unit').value = unit;
  document.getElementById('item-location').value = location;
  document.getElementById('item-expiry').value = expiry || '';
  document.getElementById('item-category').value = category || '';
  document.getElementById('item-modal').style.display = 'block';
}

function closeModal() {
  document.getElementById('item-modal').style.display = 'none';
  editingId = null;
}

async function saveItem() {
  const name = document.getElementById('item-name').value.trim();
  const quantity = parseFloat(document.getElementById('item-quantity').value);
  const unit = document.getElementById('item-unit').value.trim();
  const storageLocation = document.getElementById('item-location').value;
  const expiry = document.getElementById('item-expiry').value.trim() || null;
  const category = document.getElementById('item-category').value.trim() || null;

  if (!name || isNaN(quantity) || !unit || !storageLocation) {
    alert('Please fill in all required fields');
    return;
  }

  const body = { item_name: name, quantity, unit, location: storageLocation, expiry_date: expiry, category };

  try {
    const url = editingId ? '/api/inventory/' + editingId : '/api/inventory';
    const method = editingId ? 'PUT' : 'POST';
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (data.error) alert('Error: ' + data.error);
    else { closeModal(); window.location.reload(); }
  } catch (err) { alert('Failed to save item'); }
}

async function deleteItem(id) {
  if (!confirm('Delete this item?')) return;
  try {
    const response = await fetch('/api/inventory/' + id, { method: 'DELETE' });
    const data = await response.json();
    if (data.error) alert('Error: ' + data.error);
    else location.reload();
  } catch (err) { alert('Failed to delete item'); }
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('item-modal');
  if (event.target === modal) closeModal();
}
`}>
    <h1>Inventory</h1>

    {/* Modal */}
    <div id="item-modal" style="display:none; position:fixed; z-index:1000; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.4);">
      <div style="background:white; margin:80px auto; padding:20px; border-radius:8px; width:400px; max-width:90%;">
        <h2 id="modal-title" style="margin-top:0;">Add Item</h2>
        <input type="hidden" id="item-id" />
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Name *</label>
          <input type="text" id="item-name" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Quantity *</label>
          <input type="number" id="item-quantity" step="any" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Unit *</label>
          <input type="text" id="item-unit" placeholder="e.g. kg, lbs, pieces" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Location *</label>
          <select id="item-location" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
            <option value="fridge">Fridge</option>
            <option value="pantry">Pantry</option>
          </select>
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Expiry Date</label>
          <input type="date" id="item-expiry" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Category</label>
          <input type="text" id="item-category" placeholder="e.g. dairy, vegetables" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn" onclick="saveItem()">Save</button>
        </div>
      </div>
    </div>

    <h2>Fridge</h2>
    <button class="btn" onclick="openAddModal('fridge')" style="margin-bottom:15px;">Add Item</button>
    {fridgeItems.length > 0 ? (
      <table>
        <thead><tr><th>Item</th><th>Quantity</th><th>Unit</th><th>Expiry</th><th>Actions</th></tr></thead>
        <tbody>
          {fridgeItems.map(item => (
            <tr>
              <td>{item.item_name}</td>
              <td>{item.quantity}</td>
              <td>{item.unit}</td>
              <td>{item.expiry_date || "-"}</td>
              <td>
                <button class="btn btn-secondary" onclick={`openEditModal(${item.id}, '${escJs(item.item_name)}', ${item.quantity}, '${escJs(item.unit)}', 'fridge', '${item.expiry_date || ''}', '${escJs(item.category || '')}')`}>Edit</button>
                <button class="btn btn-danger" onclick={`deleteItem(${item.id})`}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : <p>No items in fridge.</p>}

    <h2>Pantry</h2>
    <button class="btn" onclick="openAddModal('pantry')" style="margin-bottom:15px;">Add Item</button>
    {pantryItems.length > 0 ? (
      <table>
        <thead><tr><th>Item</th><th>Quantity</th><th>Unit</th><th>Expiry</th><th>Category</th><th>Actions</th></tr></thead>
        <tbody>
          {pantryItems.map(item => (
            <tr>
              <td>{item.item_name}</td>
              <td>{item.quantity}</td>
              <td>{item.unit}</td>
              <td>{item.expiry_date || "-"}</td>
              <td>{item.category || "-"}</td>
              <td>
                <button class="btn btn-secondary" onclick={`openEditModal(${item.id}, '${escJs(item.item_name)}', ${item.quantity}, '${escJs(item.unit)}', 'pantry', '${item.expiry_date || ''}', '${escJs(item.category || '')}')`}>Edit</button>
                <button class="btn btn-danger" onclick={`deleteItem(${item.id})`}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : <p>No items in pantry.</p>}
  </Layout>;
};

// Shopping List page (similar to Inventory: add/edit/delete items)
const GroceryPage: FC<{ products: GroceryProduct[] }> = ({ products }) => {
  return <Layout title="Shopping List" scripts={`
let editingId = null;

function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Add Item';
  document.getElementById('item-id').value = '';
  document.getElementById('item-name').value = '';
  document.getElementById('item-quantity').value = '';
  document.getElementById('item-unit').value = '';
  document.getElementById('item-stock').value = 'sufficient';
  document.getElementById('item-reference').value = '';
  document.getElementById('item-modal').style.display = 'block';
}

function openEditModal(id, name, quantity, unit, stockStatus, reference) {
  editingId = id;
  document.getElementById('modal-title').textContent = 'Edit Item';
  document.getElementById('item-id').value = id;
  document.getElementById('item-name').value = name;
  document.getElementById('item-quantity').value = quantity;
  document.getElementById('item-unit').value = unit;
  document.getElementById('item-stock').value = stockStatus;
  document.getElementById('item-reference').value = reference || '';
  document.getElementById('item-modal').style.display = 'block';
}

function closeModal() {
  document.getElementById('item-modal').style.display = 'none';
  editingId = null;
}

async function saveItem() {
  const name = document.getElementById('item-name').value.trim();
  const quantity = parseFloat(document.getElementById('item-quantity').value);
  const unit = document.getElementById('item-unit').value.trim();
  const stockStatus = document.getElementById('item-stock').value;
  const reference = document.getElementById('item-reference').value.trim() || null;

  if (!name || isNaN(quantity) || !unit || !stockStatus) {
    alert('Please fill in all required fields');
    return;
  }

  const body = { name, quantity, unit, stock_status: stockStatus, reference };

  try {
    const url = editingId ? '/api/grocery/products/' + editingId : '/api/grocery/products';
    const method = editingId ? 'PUT' : 'POST';
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (data.error) alert('Error: ' + data.error);
    else { closeModal(); location.reload(); }
  } catch (err) { alert('Failed to save item'); }
}

async function deleteItem(id) {
  if (!confirm('Delete this item?')) return;
  try {
    const response = await fetch('/api/grocery/products/' + id, { method: 'DELETE' });
    const data = await response.json();
    if (data.error) alert('Error: ' + data.error);
    else location.reload();
  } catch (err) { alert('Failed to delete item'); }
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('item-modal');
  if (event.target === modal) closeModal();
}
`}>
    <h1>Shopping List</h1>

    {/* Modal */}
    <div id="item-modal" style="display:none; position:fixed; z-index:1000; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.4);">
      <div style="background:white; margin:80px auto; padding:20px; border-radius:8px; width:400px; max-width:90%;">
        <h2 id="modal-title" style="margin-top:0;">Add Item</h2>
        <input type="hidden" id="item-id" />
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Name *</label>
          <input type="text" id="item-name" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Quantity *</label>
          <input type="number" id="item-quantity" step="any" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Unit *</label>
          <input type="text" id="item-unit" placeholder="e.g. kg, lbs, pieces" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Stock Status *</label>
          <select id="item-stock" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
            <option value="sufficient">Sufficient</option>
            <option value="insufficient">Insufficient</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Order Reference</label>
          <input type="text" id="item-reference" placeholder="e.g. ORD000001" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn" onclick="saveItem()">Save</button>
        </div>
      </div>
    </div>

    <button class="btn" onclick="openAddModal()" style="margin-bottom:15px;">Add Item</button>
    {products.length > 0 ? (
      <table>
        <thead><tr><th>Product</th><th>Quantity</th><th>Unit</th><th>Stock</th><th>Order Reference</th><th>Actions</th></tr></thead>
        <tbody>
          {products.map(p => (
            <tr>
              <td>{p.name}</td>
              <td>{p.quantity}</td>
              <td>{p.unit}</td>
              <td>
                <span class={`status-badge ${p.stock_status === "sufficient" ? "status-ready" : p.stock_status === "insufficient" ? "status-brewing" : "status-scheduled"}`}>
                  {p.stock_status.replace("_", " ").toUpperCase()}
                </span>
              </td>
              <td>{p.reference || "-"}</td>
              <td>
                <button class="btn btn-secondary" onclick={`openEditModal('${escJs(p.product_id)}', '${escJs(p.name)}', ${p.quantity}, '${escJs(p.unit)}', '${escJs(p.stock_status)}', '${escJs(p.reference || '')}')`}>Edit</button>
                <button class="btn btn-danger" onclick={`deleteItem('${escJs(p.product_id)}')`}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : <p>No items in shopping list.</p>}
  </Layout>;
};

// Calendar page
const CalendarPage: FC<{ events: CalendarEvent[] }> = ({ events }) => {
  return <Layout title="Calendar" scripts={`
let editingId = null;

function openEditModal(id, title, startTime, eventType, workoutType) {
  editingId = id;
  document.getElementById('modal-title').textContent = 'Edit Event';
  document.getElementById('event-id').value = id;
  document.getElementById('event-title').value = title;
  document.getElementById('event-time').value = startTime;
  document.getElementById('event-type').value = eventType || '';
  document.getElementById('workout-type').value = workoutType || '';
  document.getElementById('event-modal').style.display = 'block';
}

function closeModal() {
  document.getElementById('event-modal').style.display = 'none';
  editingId = null;
}

async function saveEvent() {
  const title = document.getElementById('event-title').value.trim();
  const startTime = document.getElementById('event-time').value.trim();
  const eventType = document.getElementById('event-type').value.trim();
  const workoutType = document.getElementById('workout-type').value;

  if (!editingId) { alert('No event selected'); return; }

  const body = {};
  if (title) body.title = title;
  if (startTime) body.start_time = startTime;
  if (eventType) body.event_type = eventType;
  if (workoutType) body.workout_type = workoutType;

  try {
    const response = await fetch('/api/calendar/' + editingId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (data.error) alert('Error: ' + data.error);
    else { closeModal(); location.reload(); }
  } catch (err) { alert('Failed to save event'); }
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('event-modal');
  if (event.target === modal) closeModal();
}
`}>
    <h1>Calendar</h1>

    {/* Modal */}
    <div id="event-modal" style="display:none; position:fixed; z-index:1000; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.4);">
      <div style="background:white; margin:80px auto; padding:20px; border-radius:8px; width:400px; max-width:90%;">
        <h2 id="modal-title" style="margin-top:0;">Edit Event</h2>
        <input type="hidden" id="event-id" />
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Title</label>
          <input type="text" id="event-title" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Start Time</label>
          <input type="text" id="event-time" placeholder="e.g. 2026-05-09T10:00:00Z" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Event Type</label>
          <input type="text" id="event-type" placeholder="e.g. workout, meeting" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Workout Type</label>
          <select id="workout-type" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
            <option value="">-- None --</option>
            <option value="hiit">HIIT</option>
            <option value="yoga">Yoga</option>
            <option value="walking">Walking</option>
            <option value="cycling">Cycling</option>
            <option value="strength">Strength</option>
            <option value="stretching">Stretching</option>
            <option value="swimming">Swimming</option>
            <option value="rest">Rest</option>
          </select>
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn" onclick="saveEvent()">Save</button>
        </div>
      </div>
    </div>

    <table>
      <thead><tr><th>Event</th><th>Time</th><th>Type</th><th>Workout</th><th>Actions</th></tr></thead>
      <tbody>
        {events.map(event => (
          <tr>
            <td>{event.title}</td>
            <td>{event.start_time}</td>
            <td>{event.event_type || "-"}</td>
            <td>{event.workout_type || "-"}</td>
            <td>
              <button class="btn btn-secondary" style="padding:4px 12px;" onclick={`openEditModal(${event.id}, '${escJs(event.title)}', '${escJs(event.start_time)}', '${escJs(event.event_type || '')}', '${escJs(event.workout_type || '')}')`}>Edit</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </Layout>;
};

// Meal Plan page
const MealPlanPage: FC<{ constraints: UserConstraints; recipes: Recipe[]; currentPlan: MealPlan | null }> = ({ constraints, recipes, currentPlan }) => {
  // Group recipes by meal type
  const breakfastRecipes = recipes.filter(r => r.meal_type === "breakfast");
  const lunchRecipes = recipes.filter(r => r.meal_type === "lunch");
  const dinnerRecipes = recipes.filter(r => r.meal_type === "dinner");

  return <Layout title="Meal Planning" scripts={`
let currentPlan = null;
let editingPlan = null;

function initPlanData() {
  const today = new Date();
  const days = [];
  // Start with just 1 day for simplicity
  const date = new Date(today);
  days.push({
    date: date.toISOString().split('T')[0],
    meals: []
  });
  return days;
}

function openCreateModal() {
  editingPlan = null;
  document.getElementById('plan-modal-title').textContent = 'Create Meal Plan';
  renderPlanEditor(initPlanData());
  document.getElementById('plan-modal').style.display = 'block';
}

function openEditModal() {
  if (!currentPlan) return;
  editingPlan = currentPlan;
  document.getElementById('plan-modal-title').textContent = 'Edit Meal Plan';
  renderPlanEditor(JSON.parse(currentPlan.plan_data));
  document.getElementById('plan-modal').style.display = 'block';
}

function closePlanModal() {
  document.getElementById('plan-modal').style.display = 'none';
  editingPlan = null;
}

function renderPlanEditor(days) {
  const container = document.getElementById('plan-days');
  const mealTypes = ['breakfast', 'lunch', 'dinner'];
  const recipes = ${JSON.stringify(recipes.map(r => ({ id: r.id, name: r.name, meal_type: r.meal_type, calories_total: r.calories_total })))};

  let html = '';
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    html += '<div class="day-card"><h3>' + day.date + '</h3>';
    for (const mealType of mealTypes) {
      const meal = day.meals.find(m => m.meal_type === mealType);
      const mealRecipes = recipes.filter(r => r.meal_type === mealType);
      html += '<div class="meal-row"><label>' + mealType.charAt(0).toUpperCase() + mealType.slice(1) + ':</label>';
      html += '<select id="day-' + i + '-' + mealType + '" onchange="updateCalories()">';
      html += '<option value="">-- Select --</option>';
      for (const r of mealRecipes) {
        const selected = meal && meal.meal_id === r.id ? ' selected' : '';
        html += '<option value="' + r.id + '"' + selected + '>' + r.name + ' (' + r.calories_total + ' kcal)</option>';
      }
      html += '</select></div>';
    }
    html += '</div>';
  }
  container.innerHTML = html;
  updateCalories();
}

function updateCalories() {
  const recipes = ${JSON.stringify(recipes.map(r => ({ id: r.id, calories_total: r.calories_total })))};
  const container = document.getElementById('plan-days');
  const dayCards = container.querySelectorAll('.day-card');
  const numDays = dayCards.length;
  let totalCalories = 0;
  for (let i = 0; i < numDays; i++) {
    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      const select = document.getElementById('day-' + i + '-' + mealType);
      if (select && select.value) {
        const recipe = recipes.find(r => r.id === parseInt(select.value));
        if (recipe) totalCalories += recipe.calories_total;
      }
    }
  }
  document.getElementById('total-calories').textContent = totalCalories + ' kcal';
  document.getElementById('avg-calories').textContent = numDays > 0 ? Math.round(totalCalories / numDays) + ' kcal/day' : '0 kcal/day';
}

function savePlan() {
  const days = [];
  const container = document.getElementById('plan-days');
  const dayCards = container.querySelectorAll('.day-card');
  const numDays = dayCards.length;
  for (let i = 0; i < numDays; i++) {
    const dateInput = document.querySelector('#plan-days .day-card:nth-child(' + (i + 1) + ') h3');
    const meals = [];
    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      const select = document.getElementById('day-' + i + '-' + mealType);
      if (select && select.value) {
        meals.push({ meal_type: mealType, meal_id: parseInt(select.value) });
      }
    }
    days.push({ date: dateInput.textContent, meals });
  }

  fetch('/api/meal-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days })
  })
  .then(r => r.json())
  .then(data => {
    if (data.error) alert('Error: ' + data.error);
    else { closePlanModal(); location.reload(); }
  })
  .catch(err => alert('Failed to save plan'));
}

function deletePlan() {
  if (!currentPlan) return;
  if (!confirm('Delete current meal plan?')) return;
  fetch('/api/meal-plan', { method: 'DELETE' })
    .then(r => r.json())
    .then(data => {
      if (data.error) alert('Error: ' + data.error);
      else location.reload();
    })
    .catch(err => alert('Failed to delete plan'));
}

// Initialize currentPlan from server data
const planDataElement = document.getElementById('current-plan-data');
if (planDataElement && planDataElement.textContent) {
  try {
    currentPlan = JSON.parse(planDataElement.textContent);
  } catch (e) {}
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('plan-modal');
  if (event.target === modal) closePlanModal();
}
`}>
    <h1>Meal Planning</h1>

    {/* Hidden data for JS */}
    <script id="current-plan-data" type="application/json">{currentPlan ? JSON.stringify(currentPlan) : ""}</script>

    <h2>Your Constraints</h2>
    <div class="card">
      <div class="metric">
        <span class="metric-label">Calorie Target</span>
        <span class="metric-value">{`${constraints.calorie_target} kcal/day`}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Weekly Budget</span>
        <span class="metric-value">{`$${constraints.weekly_budget_limit}`}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Allergies</span>
        <span class="metric-value">{constraints.allergy_constraints}</span>
      </div>
    </div>

    <h2>Current Meal Plan</h2>
    {currentPlan ? (
      <div class="card">
        <div class="metric">
          <span class="metric-label">Plan ID</span>
          <span class="metric-value">{currentPlan.plan_id}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Created</span>
          <span class="metric-value">{currentPlan.created_at}</span>
        </div>
        <div style="margin-top: 15px;">
          <button class="btn btn-secondary" onclick="openEditModal()">Edit Plan</button>
        </div>
        <table style="margin-top: 15px;">
          <thead><tr><th>Date</th><th>Breakfast</th><th>Lunch</th><th>Dinner</th><th>Daily Calories</th></tr></thead>
          <tbody id="current-plan-table"></tbody>
        </table>
        <script>{`
          const planData = ${JSON.stringify(currentPlan.plan_data)};
          const recipes = ${JSON.stringify(recipes)};
          const table = document.getElementById('current-plan-table');
          let html = '';
          for (const day of JSON.parse(planData)) {
            let dayCalories = 0;
            const meals = { breakfast: '-', lunch: '-', dinner: '-' };
            for (const m of day.meals) {
              const recipe = recipes.find(r => r.id === m.meal_id);
              if (recipe) {
                meals[m.meal_type] = recipe.name;
                dayCalories += recipe.calories_total;
              }
            }
            html += '<tr><td>' + day.date + '</td><td>' + meals.breakfast + '</td><td>' + meals.lunch + '</td><td>' + meals.dinner + '</td><td>' + dayCalories + ' kcal</td></tr>';
          }
          table.innerHTML = html;
        `}</script>
      </div>
    ) : (
      <div class="card">
        <p>No meal plan created yet.</p>
        <button class="btn" onclick="openCreateModal()" style="margin-top: 10px;">Create Meal Plan</button>
      </div>
    )}

    <h2>Available Recipes</h2>
    <table>
      <thead><tr><th>Name</th><th>Meal</th><th>Calories</th><th>Allergens</th></tr></thead>
      <tbody>
        {recipes.map(r => (
          <tr>
            <td>{r.name}</td>
            <td>{r.meal_type}</td>
            <td>{`${r.calories_total} kcal`}</td>
            <td>{r.allergens || "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>

    {/* Modal */}
    <div id="plan-modal" style="display:none; position:fixed; z-index:1000; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.4); overflow:auto;">
      <div style="background:white; margin:20px auto; padding:20px; border-radius:8px; width:900px; max-width:95%; max-height:90vh; overflow-y:auto;">
        <h2 id="plan-modal-title" style="margin-top:0;">Create Weekly Meal Plan</h2>
        <div style="margin-bottom:15px; padding:10px; background:#f8f9fa; border-radius:4px;">
          <strong>Weekly Total:</strong> <span id="total-calories">0 kcal</span> |
          <strong> Daily Avg:</strong> <span id="avg-calories">0 kcal/day</span>
          <span style="margin-left:15px; color:#666;">Target: {constraints.calorie_target} kcal/day</span>
        </div>
        <div id="plan-days" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:15px;"></div>
        <div style="margin-top:20px; display:flex; gap:8px; justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="closePlanModal()">Cancel</button>
          <button class="btn" onclick="savePlan()">Save Plan</button>
        </div>
      </div>
    </div>

    <style>{`
      .day-card { background: #f8f9fa; padding: 12px; border-radius: 6px; }
      .day-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #333; }
      .meal-row { margin-bottom: 8px; }
      .meal-row label { display: block; font-size: 12px; color: #666; margin-bottom: 2px; }
      .meal-row select { width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; }
    `}</style>
  </Layout>;
};

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

function registerRoutes(app: OpenAPIApp): void {
  // Sentinel route for binary isolation verification
  app.get("/__mock_sentinel__/smarthome", (c) =>
    c.json({ mock: "smarthome", sentinel: true }),
  );

  // --- HTML Pages ---

  // Dashboard
  app.page("/", (c) => {
    const database = assertDb();
    const metrics = database.query("SELECT * FROM room_metrics LIMIT 1").get() as RoomMetrics;
    const thermostat = database.query("SELECT * FROM thermostat_settings WHERE id = 1").get() as ThermostatSettings;

    if (!metrics || !thermostat) {
      return c.html(<ErrorPage title="Service Error" message="Required data unavailable. Please check system configuration." />, 500);
    }

    return c.html(<DashboardPage metrics={metrics} thermostat={thermostat} />);
  });

  // Thermostat page
  app.page("/thermostat", (c) => {
    const database = assertDb();
    const thermostat = database.query("SELECT * FROM thermostat_settings WHERE id = 1").get() as ThermostatSettings;

    if (!thermostat) {
      return c.html(<ErrorPage title="Service Error" message="Thermostat data unavailable. Please check system configuration." />, 500);
    }

    return c.html(<ThermostatPage thermostat={thermostat} />);
  });

  // Coffee page
  app.page("/coffee", (c) => {
    const database = assertDb();
    const schedule = database.query("SELECT start_time, beans_grams, cancelled, updated_at FROM coffee_schedule WHERE id = 1").get() as { start_time: string; beans_grams: number; cancelled: number; updated_at: string };
    const clock = database.query("SELECT clock_time FROM benchmark_clock WHERE id = 1").get() as { clock_time: string };

    if (!schedule) {
      return c.html(<ErrorPage title="Service Error" message="Coffee schedule data unavailable." />, 500);
    }

    const status = clock ? deriveCoffeeStatus(schedule.start_time, clock.clock_time) : "scheduled";
    return c.html(<CoffeePage schedule={{ start_time: schedule.start_time, status, beans_grams: schedule.beans_grams, cancelled: schedule.cancelled === 1, updated_at: schedule.updated_at }} />);
  });

  // Inventory page
  app.page("/inventory", (c) => {
    const database = assertDb();
    const items = database.query("SELECT * FROM inventory_item ORDER BY location, item_name").all() as InventoryItem[];
    // Inventory can be empty, no error needed
    return c.html(<InventoryPage items={items} />);
  });

  // Grocery page
  app.page("/grocery", (c) => {
    const database = assertDb();
    const products = database.query("SELECT * FROM grocery_product ORDER BY name").all() as GroceryProduct[];
    return c.html(<GroceryPage products={products} />);
  });

  // Wearable page
  app.page("/wearable", (c) => {
    const database = assertDb();
    const data = database.query("SELECT sleep_hours, sleep_score, readiness, resting_heart_rate FROM wearable_recovery_state WHERE id = 1").get() as WearableRecovery;

    if (!data) {
      return c.html(<ErrorPage title="Service Error" message="Wearable data unavailable." />, 500);
    }

    return c.html(<WearablePage data={data} />);
  });

  // Calendar page
  app.page("/calendar", (c) => {
    const database = assertDb();
    const events = database.query("SELECT * FROM calendar_event ORDER BY start_time").all() as CalendarEvent[];
    // Calendar can be empty, no error needed
    return c.html(<CalendarPage events={events} />);
  });

  // Meal Plan page
  app.page("/meal-plan", (c) => {
    const database = assertDb();
    const constraints = database.query("SELECT * FROM user_constraints WHERE id = 1").get() as UserConstraints;
    const recipes = database.query("SELECT * FROM recipe ORDER BY meal_type, name").all() as Recipe[];
    const currentPlan = database.query("SELECT plan_id, created_at, plan_data FROM meal_plan ORDER BY created_at DESC, id DESC LIMIT 1").get() as MealPlan | null;

    if (!constraints) {
      return c.html(<ErrorPage title="Service Error" message="Constraints data unavailable. Please check system configuration." />, 500);
    }

    return c.html(<MealPlanPage constraints={constraints} recipes={recipes} currentPlan={currentPlan} />);
  });

  // --- API Routes ---

  // Room Metrics API
  app.get("/api/room-metrics", (c) => {
    const database = assertDb();
    const metrics = database.query("SELECT temperature, humidity, unit_temp, noise, light, air_quality FROM room_metrics LIMIT 1").get();
    if (!metrics) {
      return c.json({ error: "Room metrics unavailable" }, 503);
    }
    return c.json(metrics);
  });

  // Thermostat API
  app.get("/api/thermostat", (c) => {
    const database = assertDb();
    const thermostat = database.query("SELECT mode, temperature, updated_at FROM thermostat_settings WHERE id = 1").get();
    if (!thermostat) {
      return c.json({ error: "Thermostat settings not found" }, 404);
    }
    return c.json(thermostat);
  });

  app.post("/api/thermostat", async (c) => {
    let body: { mode?: string; temperature?: number };
    try {
      body = await c.req.json();
    } catch (err) {
      if (err instanceof SyntaxError) {
        return c.json({ error: "Invalid JSON body" }, 400);
      }
      console.error("mock-smarthome: ERROR parsing request body:", err);
      return c.json({ error: "Internal server error" }, 500);
    }

    const mode = body.mode?.toLowerCase();
    const temperature = body.temperature;

    if (!mode || !isValidThermostatMode(mode)) {
      return c.json({ error: "Invalid mode. Must be comfort, eco, or off" }, 400);
    }

    if (typeof temperature !== "number" || !Number.isFinite(temperature)) {
      return c.json({ error: "Temperature must be a valid number" }, 400);
    }

    const database = assertDb();

    // Verify singleton exists before update
    const existing = database.query("SELECT id FROM thermostat_settings WHERE id = 1").get();
    if (!existing) {
      return c.json({ error: "Thermostat settings unavailable - required state not initialized" }, 503);
    }

    const now = getBenchmarkTime();
    database.query("UPDATE thermostat_settings SET mode = ?, temperature = ?, updated_at = ? WHERE id = 1").run(mode, temperature, now);

    return c.json({ mode, temperature, updated_at: now });
  });

  // Coffee Schedule API
  app.get("/api/coffee-schedule", (c) => {
    const database = assertDb();
    const schedule = database.query("SELECT start_time, beans_grams, cancelled, updated_at FROM coffee_schedule WHERE id = 1").get() as { start_time: string; beans_grams: number; cancelled: number; updated_at: string };
    const clock = database.query("SELECT clock_time FROM benchmark_clock WHERE id = 1").get() as { clock_time: string };

    if (!schedule) {
      return c.json({ error: "Coffee schedule not found" }, 404);
    }

    const status = clock ? deriveCoffeeStatus(schedule.start_time, clock.clock_time) : "scheduled";
    return c.json({ start_time: schedule.start_time, status, beans_grams: schedule.beans_grams, cancelled: schedule.cancelled === 1, updated_at: schedule.updated_at });
  });

  app.post("/api/coffee-schedule", async (c) => {
    let body: { start_time?: string; beans_grams?: number; cancelled?: boolean };
    try {
      body = await c.req.json();
    } catch (err) {
      if (err instanceof SyntaxError) {
        return c.json({ error: "Invalid JSON body" }, 400);
      }
      console.error("mock-smarthome: ERROR parsing request body:", err);
      return c.json({ error: "Internal server error" }, 500);
    }

    const database = assertDb();

    // Verify singleton exists before update
    const existing = database.query("SELECT id FROM coffee_schedule WHERE id = 1").get();
    if (!existing) {
      return c.json({ error: "Coffee schedule unavailable - required state not initialized" }, 503);
    }

    const now = getBenchmarkTime();

    // Handle cancellation
    if (body.cancelled === true) {
      database.query("UPDATE coffee_schedule SET cancelled = 1, updated_at = ? WHERE id = 1").run(now);
      return c.json({ cancelled: true, updated_at: now });
    }

    // Handle update
    const startTime = body.start_time;
    if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
      return c.json({ error: "Invalid start_time format. Use HH:MM format" }, 400);
    }

    // Validate HH:MM bounds (reject invalid times like 29:99)
    const [hour, min] = startTime.split(":").map(Number);
    if (hour < 0 || hour > 23 || min < 0 || min > 59) {
      return c.json({ error: "Invalid time value. Hour must be 0-23, minute must be 0-59" }, 400);
    }

    const beansGrams = body.beans_grams ?? 20;
    if (typeof beansGrams !== "number" || beansGrams < 5 || beansGrams > 100) {
      return c.json({ error: "Beans amount must be between 5g and 100g" }, 400);
    }

    database.query("UPDATE coffee_schedule SET start_time = ?, beans_grams = ?, cancelled = 0, updated_at = ? WHERE id = 1").run(startTime, beansGrams, now);

    return c.json({ start_time: startTime, beans_grams: beansGrams, cancelled: false, updated_at: now });
  });

  // Inventory API
  app.get("/api/inventory", (c) => {
    const database = assertDb();
    const location = c.req.query("location");

    let query = "SELECT id, item_name, quantity, unit, location, expiry_date, category FROM inventory_item";
    const params: string[] = [];

    if (location) {
      query += " WHERE location = ?";
      params.push(location);
    }

    const items = database.query(query).all(...params) as InventoryItem[];
    return c.json(items);
  });

  app.post("/api/inventory", async (c) => {
    let body: Partial<InventoryItem>;
    try {
      body = await c.req.json();
    } catch (err) {
      if (err instanceof SyntaxError) {
        return c.json({ error: "Invalid JSON body" }, 400);
      }
      console.error("mock-smarthome: ERROR parsing request body:", err);
      return c.json({ error: "Internal server error" }, 500);
    }

    if (!body.item_name || typeof body.quantity !== "number" || !body.unit || !body.location) {
      return c.json({ error: "Missing required fields: item_name, quantity, unit, location" }, 400);
    }

    const database = assertDb();
    const result = database.query(
      "INSERT INTO inventory_item (item_name, quantity, unit, location, expiry_date, category) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(body.item_name, body.quantity, body.unit, body.location, body.expiry_date || null, body.category || null);

    return c.json({
      id: result.lastInsertRowid as number,
      item_name: body.item_name,
      quantity: body.quantity,
      unit: body.unit,
      location: body.location,
      expiry_date: body.expiry_date,
      category: body.category
    }, 201);
  });

  app.put("/api/inventory/:id", async (c) => {
    const idParam = c.req.param("id");
    const id = Number(idParam);
    if (isNaN(id) || !Number.isInteger(id) || id <= 0) {
      return c.json({ error: "Invalid id: must be a positive integer" }, 400);
    }

    let body: Partial<InventoryItem>;
    try {
      body = await c.req.json();
    } catch (err) {
      if (err instanceof SyntaxError) {
        return c.json({ error: "Invalid JSON body" }, 400);
      }
      console.error("mock-smarthome: ERROR parsing request body:", err);
      return c.json({ error: "Internal server error" }, 500);
    }

    const database = assertDb();
    const existing = database.query("SELECT id FROM inventory_item WHERE id = ?").get(id);
    if (!existing) {
      return c.json({ error: "Item not found" }, 404);
    }

    // Validate quantity if provided
    if (body.quantity !== undefined && (typeof body.quantity !== "number" || !Number.isFinite(body.quantity))) {
      return c.json({ error: "Quantity must be a valid number" }, 400);
    }

    // Validate location if provided
    if (body.location !== undefined && !["fridge", "pantry"].includes(body.location)) {
      return c.json({ error: "Location must be 'fridge' or 'pantry'" }, 400);
    }

    const now = getBenchmarkTime();
    database.query(
      "UPDATE inventory_item SET item_name = COALESCE(?, item_name), quantity = COALESCE(?, quantity), unit = COALESCE(?, unit), location = COALESCE(?, location), expiry_date = COALESCE(?, expiry_date), category = COALESCE(?, category), updated_at = ? WHERE id = ?"
    ).run(body.item_name ?? null, body.quantity ?? null, body.unit ?? null, body.location ?? null, body.expiry_date ?? null, body.category ?? null, now, id);

    const updated = database.query("SELECT id, item_name, quantity, unit, location, expiry_date, category FROM inventory_item WHERE id = ?").get(id);
    return c.json(updated);
  });

  app.delete("/api/inventory/:id", (c) => {
    const idParam = c.req.param("id");
    const id = Number(idParam);
    if (isNaN(id) || !Number.isInteger(id) || id <= 0) {
      return c.json({ error: "Invalid id: must be a positive integer" }, 400);
    }

    const database = assertDb();
    const existing = database.query("SELECT id FROM inventory_item WHERE id = ?").get(id);
    if (!existing) {
      return c.json({ error: "Item not found" }, 404);
    }

    database.query("DELETE FROM inventory_item WHERE id = ?").run(id);
    return c.json({ success: true });
  });

  // Shopping List API
  app.get("/api/grocery/products", (c) => {
    const database = assertDb();
    const products = database.query("SELECT product_id, name, quantity, unit, stock_status, substitute_for, reference FROM grocery_product ORDER BY name").all();
    return c.json(products);
  });

  app.post("/api/grocery/products", async (c) => {
    let body: Partial<GroceryProduct>;
    try {
      body = await c.req.json();
    } catch (err) {
      if (err instanceof SyntaxError) {
        return c.json({ error: "Invalid JSON body" }, 400);
      }
      console.error("mock-smarthome: ERROR parsing request body:", err);
      return c.json({ error: "Internal server error" }, 500);
    }

    if (!body.name || typeof body.quantity !== "number" || !body.unit || !body.stock_status) {
      return c.json({ error: "Missing required fields: name, quantity, unit, stock_status" }, 400);
    }

    const validStockStatuses = ["sufficient", "insufficient", "unavailable"];
    if (!validStockStatuses.includes(body.stock_status)) {
      return c.json({ error: "Invalid stock_status. Must be sufficient, insufficient, or unavailable" }, 400);
    }

    const database = assertDb();

    // Generate product_id
    const timestamp = getBenchmarkTime().replace(/[-:T]/g, "").substring(0, 14);
    const productId = `PROD${timestamp}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    database.query(
      "INSERT INTO grocery_product (product_id, name, quantity, unit, stock_status, substitute_for, reference) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(productId, body.name, body.quantity, body.unit, body.stock_status, body.substitute_for || null, body.reference || null);

    return c.json({
      product_id: productId,
      name: body.name,
      quantity: body.quantity,
      unit: body.unit,
      stock_status: body.stock_status,
      substitute_for: body.substitute_for,
      reference: body.reference
    }, 201);
  });

  app.put("/api/grocery/products/:id", async (c) => {
    const idParam = c.req.param("id");
    if (!idParam) {
      return c.json({ error: "Product ID required" }, 400);
    }

    let body: Partial<GroceryProduct>;
    try {
      body = await c.req.json();
    } catch (err) {
      if (err instanceof SyntaxError) {
        return c.json({ error: "Invalid JSON body" }, 400);
      }
      console.error("mock-smarthome: ERROR parsing request body:", err);
      return c.json({ error: "Internal server error" }, 500);
    }

    const database = assertDb();
    const existing = database.query("SELECT product_id FROM grocery_product WHERE product_id = ?").get(idParam);
    if (!existing) {
      return c.json({ error: "Product not found" }, 404);
    }

    // Validate quantity if provided
    if (body.quantity !== undefined && (typeof body.quantity !== "number" || !Number.isFinite(body.quantity))) {
      return c.json({ error: "Quantity must be a valid number" }, 400);
    }

    // Validate stock_status if provided
    if (body.stock_status !== undefined) {
      const validStockStatuses = ["sufficient", "insufficient", "unavailable"];
      if (!validStockStatuses.includes(body.stock_status)) {
        return c.json({ error: "Invalid stock_status. Must be sufficient, insufficient, or unavailable" }, 400);
      }
    }

    database.query(
      "UPDATE grocery_product SET name = COALESCE(?, name), quantity = COALESCE(?, quantity), unit = COALESCE(?, unit), stock_status = COALESCE(?, stock_status), substitute_for = COALESCE(?, substitute_for), reference = COALESCE(?, reference) WHERE product_id = ?"
    ).run(body.name ?? null, body.quantity ?? null, body.unit ?? null, body.stock_status ?? null, body.substitute_for ?? null, body.reference ?? null, idParam);

    const updated = database.query("SELECT product_id, name, quantity, unit, stock_status, substitute_for, reference FROM grocery_product WHERE product_id = ?").get(idParam);
    return c.json(updated);
  });

  app.delete("/api/grocery/products/:id", (c) => {
    const idParam = c.req.param("id");
    if (!idParam) {
      return c.json({ error: "Product ID required" }, 400);
    }

    const database = assertDb();
    const existing = database.query("SELECT product_id FROM grocery_product WHERE product_id = ?").get(idParam);
    if (!existing) {
      return c.json({ error: "Product not found" }, 404);
    }

    database.query("DELETE FROM grocery_product WHERE product_id = ?").run(idParam);
    return c.json({ success: true });
  });

  // Wearable/Recovery API
  app.get("/api/wearable-recovery", (c) => {
    const database = assertDb();
    const data = database.query("SELECT sleep_hours, sleep_score, readiness, resting_heart_rate FROM wearable_recovery_state WHERE id = 1").get();
    if (!data) {
      return c.json({ error: "Wearable data unavailable" }, 503);
    }
    return c.json(data);
  });

  // Calendar/Workout API
  app.get("/api/calendar", (c) => {
    const database = assertDb();
    const events = database.query("SELECT id, title, start_time, event_type, workout_type, updated_at FROM calendar_event ORDER BY start_time").all();
    return c.json(events);
  });

  app.get("/api/calendar/:id", (c) => {
    const id = c.req.param("id");
    const database = assertDb();
    const event = database.query("SELECT id, title, start_time, event_type, workout_type, updated_at FROM calendar_event WHERE id = ?").get(id);

    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    return c.json(event);
  });

  app.put("/api/calendar/:id", async (c) => {
    const id = c.req.param("id");
    let body: { title?: string; start_time?: string; event_type?: string; workout_type?: string };
    try {
      body = await c.req.json();
    } catch (err) {
      if (err instanceof SyntaxError) {
        return c.json({ error: "Invalid JSON body" }, 400);
      }
      console.error("mock-smarthome: ERROR parsing request body:", err);
      return c.json({ error: "Internal server error" }, 500);
    }

    const database = assertDb();
    const existing = database.query("SELECT id FROM calendar_event WHERE id = ?").get(id);
    if (!existing) {
      return c.json({ error: "Event not found" }, 404);
    }

    // Validate workout_type if provided
    if (body.workout_type !== undefined && body.workout_type !== null && !isValidWorkoutType(body.workout_type)) {
      return c.json({ error: "Invalid workout_type" }, 400);
    }

    // Normalize workout_type to lowercase before persisting (matches thermostat mode handling)
    const normalizedWorkoutType = body.workout_type !== undefined && body.workout_type !== null
      ? body.workout_type.toLowerCase()
      : null;

    const now = getBenchmarkTime();
    database.query(
      "UPDATE calendar_event SET title = COALESCE(?, title), start_time = COALESCE(?, start_time), event_type = COALESCE(?, event_type), workout_type = ?, updated_at = ? WHERE id = ?"
    ).run(body.title || null, body.start_time || null, body.event_type || null, normalizedWorkoutType, now, id);

    const updated = database.query("SELECT id, title, start_time, event_type, workout_type, updated_at FROM calendar_event WHERE id = ?").get(id);
    return c.json(updated);
  });

  // Constraints API
  app.get("/api/constraints", (c) => {
    const database = assertDb();
    const constraints = database.query("SELECT calorie_target, macro_targets, allergy_constraints, weekly_budget_limit FROM user_constraints WHERE id = 1").get();
    if (!constraints) {
      return c.json({ error: "Constraints not found" }, 404);
    }
    return c.json(constraints);
  });

  // Recipes API
  app.get("/api/recipes", (c) => {
    const database = assertDb();
    const recipes = database.query("SELECT id, name, meal_type, ingredients, calories_total, allergens FROM recipe ORDER BY meal_type, name").all();
    return c.json(recipes);
  });

  // Meal Plan API
  app.get("/api/meal-plan", (c) => {
    const database = assertDb();
    // Use id DESC as tie-breaker for deterministic retrieval when multiple plans share the same created_at
    const plan = database.query("SELECT plan_id, created_at, plan_data FROM meal_plan ORDER BY created_at DESC, id DESC LIMIT 1").get();
    if (!plan) {
      return c.json({ error: "No meal plan found" }, 404);
    }
    return c.json(plan);
  });

  app.post("/api/meal-plan", async (c) => {
    let body: { days?: Array<{ date: string; meals: Array<{ meal_type: string; meal_id: number }> }> };
    try {
      body = await c.req.json();
    } catch (e) {
      if (e instanceof SyntaxError) {
        return c.json({ error: "Invalid JSON body" }, 400);
      }
      console.error("mock-smarthome: Unexpected error parsing meal-plan body:", e);
      throw e;
    }

    const days = body.days;
    if (!days || !Array.isArray(days) || days.length < 1) {
      return c.json({ error: "At least 1 day required for meal plan" }, 400);
    }

    // Validate each day's structure
    const validMealTypes = ["breakfast", "lunch", "dinner"];
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

    for (let i = 0; i < days.length; i++) {
      const day = days[i];

      // Validate date is a valid ISO date string (YYYY-MM-DD)
      if (!day.date || typeof day.date !== "string" || !isoDateRegex.test(day.date)) {
        return c.json({ error: `Day ${i + 1}: date must be a valid ISO date string (YYYY-MM-DD)` }, 400);
      }

      // Validate date components (reject invalid dates like 2026-13-45)
      const [year, month, date] = day.date.split("-").map(Number);
      if (year < 2000 || year > 2100 || month < 1 || month > 12 || date < 1 || date > 31) {
        return c.json({ error: `Day ${i + 1}: invalid date value` }, 400);
      }

      // Validate meals array exists
      if (!day.meals || !Array.isArray(day.meals)) {
        return c.json({ error: `Day ${i + 1}: meals must be an array` }, 400);
      }

      // Validate each meal
      for (let j = 0; j < day.meals.length; j++) {
        const meal = day.meals[j];

        // Validate meal_type
        if (!meal.meal_type || typeof meal.meal_type !== "string" || !validMealTypes.includes(meal.meal_type)) {
          return c.json({ error: `Day ${i + 1}, meal ${j + 1}: meal_type must be one of breakfast, lunch, dinner` }, 400);
        }

        // Validate meal_id
        if (typeof meal.meal_id !== "number" || !Number.isInteger(meal.meal_id)) {
          return c.json({ error: `Day ${i + 1}, meal ${j + 1}: meal_id must be an integer` }, 400);
        }
      }
    }

    const database = assertDb();

    // Validate meal_ids exist
    for (const day of days) {
      for (const meal of day.meals) {
        const recipe = database.query("SELECT id FROM recipe WHERE id = ?").get(meal.meal_id);
        if (!recipe) {
          return c.json({ error: `Recipe not found: ${meal.meal_id}` }, 404);
        }
      }
    }

    const planId = generatePlanId();
    const now = getBenchmarkTime();
    const planData = JSON.stringify(days);

    database.query("INSERT INTO meal_plan (plan_id, created_at, plan_data) VALUES (?, ?, ?)").run(planId, now, planData);

    return c.json({ success: true, plan_id: planId, created_at: now }, 201);
  });

  app.delete("/api/meal-plan", (c) => {
    const database = assertDb();
    // Delete the most recent meal plan
    const result = database.query("DELETE FROM meal_plan WHERE id = (SELECT id FROM meal_plan ORDER BY created_at DESC, id DESC LIMIT 1)").run();
    if (result.changes === 0) {
      return c.json({ error: "No meal plan to delete" }, 404);
    }
    return c.json({ success: true });
  });
}

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------

export function createSmarthomeApp() {
  const app = createMockApp({
    name: "smarthome",
    port: 5004,
    healthResponse: { ok: true, status: "healthy", service: "smarthome" },
    openApi: {
      enabled: true,
      title: "Smart Home Mock API",
      version: "1.0.0",
    },
    routes: registerRoutes,
  });

  app.seed = () => {
    initDatabase();
  };

  return app;
}

if (import.meta.main) {
  const app = createSmarthomeApp();
  startServer(app);
}
