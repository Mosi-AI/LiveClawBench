/**
 * Smart Home mock service — 8-domain home automation mock
 *
 * Provides deterministic mock APIs for:
 * - Room Metrics (read-only)
 * - Thermostat (GET/POST)
 * - Coffee Schedule (GET/POST with derived status)
 * - Inventory (GET/POST/DELETE)
 * - Grocery Ordering (GET products, POST orders with transactions)
 * - Wearable/Recovery (read-only)
 * - Calendar/Workout (GET/PUT with workout_type enum)
 * - Meal Planning (GET constraints/recipes, POST/GET meal-plan)
 *
 * Uses SQLite for persistence with verifier-readable symlink.
 */

import { createMockApp, startServer } from "mock-lib";
import type { AppEnv } from "mock-lib";
import { Hono } from "hono";
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
  price: number;
  stock_status: "in_stock" | "low_stock" | "out_of_stock";
  substitute_for?: string;
}

interface GroceryOrderItem {
  id: number;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  substitute_for?: string;
}

interface GroceryOrder {
  order_id: string;
  total: number;
  created_at: string;
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

const DB_PATH = process.env.SMARTHOME_DB_PATH || "/var/lib/mock-data/smarthome/smarthome.db";
const DATA_DIR = process.env.SMARTHOME_DATA_DIR || "/opt/mock/data";
const SQL_PATH = `${DATA_DIR}/smarthome.sql`;

let db: Database | null = null;

// ---------------------------------------------------------------------------
// Database initialization
// ---------------------------------------------------------------------------

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
      updated_at TEXT NOT NULL
    );

    -- Benchmark clock for deterministic time-based status
    CREATE TABLE IF NOT EXISTS benchmark_clock (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_time TEXT NOT NULL
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
      category TEXT
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
      price REAL NOT NULL,
      stock_status TEXT NOT NULL CHECK (stock_status IN ('in_stock', 'low_stock', 'out_of_stock')),
      substitute_for TEXT
    );

    -- Grocery orders
    CREATE TABLE IF NOT EXISTS grocery_order (
      order_id TEXT PRIMARY KEY,
      total REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Grocery order items
    CREATE TABLE IF NOT EXISTS grocery_order_item (
      id INTEGER PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      substitute_for TEXT,
      FOREIGN KEY (order_id) REFERENCES grocery_order(order_id)
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

  // Load seed SQL only on first init (fresh DB), preserve existing state on restart
  if (!dbExists && existsSync(SQL_PATH)) {
    const sql = readFileSync(SQL_PATH, "utf-8");
    db.exec(sql);
    console.log(`mock-smarthome: initialized fresh DB from ${SQL_PATH}`);
  } else if (dbExists) {
    console.log(`mock-smarthome: found existing DB at ${DB_PATH}, preserving state`);
  } else {
    console.log(`mock-smarthome: no seed SQL found at ${SQL_PATH}, using empty tables`);
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
  const clock = database.query("SELECT current_time FROM benchmark_clock WHERE id = 1").get() as { current_time: string } | null;
  const capturedAt = clock?.current_time || "2026-05-06T08:00:00Z";

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
  const clock = database.query("SELECT current_time FROM benchmark_clock WHERE id = 1").get() as { current_time: string } | null;
  return clock?.current_time || "2026-05-06T08:00:00Z";
}

// Generate deterministic order ID based on benchmark clock and counter
let orderCounter = 0;
function generateOrderId(): string {
  const time = getBenchmarkTime();
  const timestamp = time.replace(/[-:T]/g, "").substring(0, 14);
  orderCounter++;
  return `ORD${timestamp}-${orderCounter.toString(36).toUpperCase().padStart(3, "0")}`;
}

// Generate deterministic plan ID based on benchmark clock and counter
let planCounter = 0;
function generatePlanId(): string {
  const time = getBenchmarkTime();
  const timestamp = time.replace(/[-:T]/g, "").substring(0, 14);
  planCounter++;
  return `PLAN${timestamp}-${planCounter.toString(36).toUpperCase().padStart(3, "0")}`;
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
<a href="/inventory">Inventory</a>
<a href="/grocery">Grocery</a>
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
async function deleteItem(id) {
  if (!confirm('Delete this item?')) return;
  try {
    const response = await fetch('/api/inventory/' + id, { method: 'DELETE' });
    const data = await response.json();
    if (data.error) alert('Error: ' + data.error);
    else location.reload();
  } catch (err) { alert('Failed to delete item'); }
}
`}>
    <h1>Inventory</h1>

    <h2>Fridge</h2>
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
              <td><button class="btn btn-danger" onclick={`deleteItem(${item.id})`}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : <p>No items in fridge.</p>}

    <h2>Pantry</h2>
    {pantryItems.length > 0 ? (
      <table>
        <thead><tr><th>Item</th><th>Quantity</th><th>Unit</th><th>Category</th><th>Actions</th></tr></thead>
        <tbody>
          {pantryItems.map(item => (
            <tr>
              <td>{item.item_name}</td>
              <td>{item.quantity}</td>
              <td>{item.unit}</td>
              <td>{item.category || "-"}</td>
              <td><button class="btn btn-danger" onclick={`deleteItem(${item.id})`}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : <p>No items in pantry.</p>}
  </Layout>;
};

// Grocery page
const GroceryPage: FC<{ products: GroceryProduct[] }> = ({ products }) => {
  return <Layout title="Grocery Catalog">
    <h1>Grocery Catalog</h1>
    <table>
      <thead><tr><th>Product</th><th>Price</th><th>Stock</th></tr></thead>
      <tbody>
        {products.map(p => (
          <tr>
            <td>{p.name}</td>
            <td>{`$${p.price.toFixed(2)}`}</td>
            <td>
              <span class={`status-badge ${p.stock_status === "in_stock" ? "status-ready" : p.stock_status === "low_stock" ? "status-brewing" : "status-scheduled"}`}>
                {p.stock_status.replace("_", " ").toUpperCase()}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </Layout>;
};

// Calendar page
const CalendarPage: FC<{ events: CalendarEvent[] }> = ({ events }) => {
  return <Layout title="Calendar" scripts={`
async function updateWorkout(id) {
  const workoutType = document.getElementById('workout-' + id).value;
  try {
    const response = await fetch('/api/calendar/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workout_type: workoutType })
    });
    const data = await response.json();
    if (data.error) alert('Error: ' + data.error);
    else location.reload();
  } catch (err) { alert('Failed to update workout'); }
}
`}>
    <h1>Calendar</h1>
    <table>
      <thead><tr><th>Event</th><th>Time</th><th>Type</th><th>Workout</th><th>Actions</th></tr></thead>
      <tbody>
        {events.map(event => (
          <tr>
            <td>{event.title}</td>
            <td>{event.start_time}</td>
            <td>{event.event_type || "-"}</td>
            <td>
              {event.workout_type ? (
                event.event_type === "workout" ? (
                  <select id={`workout-${event.id}`} onchange={`updateWorkout(${event.id})`}>
                    <option value="hiit" selected={event.workout_type === "hiit"}>HIIT</option>
                    <option value="yoga" selected={event.workout_type === "yoga"}>Yoga</option>
                    <option value="walking" selected={event.workout_type === "walking"}>Walking</option>
                    <option value="cycling" selected={event.workout_type === "cycling"}>Cycling</option>
                    <option value="strength" selected={event.workout_type === "strength"}>Strength</option>
                    <option value="stretching" selected={event.workout_type === "stretching"}>Stretching</option>
                    <option value="swimming" selected={event.workout_type === "swimming"}>Swimming</option>
                    <option value="rest" selected={event.workout_type === "rest"}>Rest</option>
                  </select>
                ) : event.workout_type
              ) : "-"}
            </td>
            <td>-</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Layout>;
};

// Meal Plan page
const MealPlanPage: FC<{ constraints: UserConstraints; recipes: Recipe[] }> = ({ constraints, recipes }) => {
  return <Layout title="Meal Planning">
    <h1>Meal Planning</h1>

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
  </Layout>;
};

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

function registerRoutes(app: Hono<AppEnv>): void {
  // Sentinel route for binary isolation verification
  app.get("/__mock_sentinel__/smarthome", (c) =>
    c.json({ mock: "smarthome", sentinel: true }),
  );

  // --- HTML Pages ---

  // Dashboard
  app.get("/", (c) => {
    const database = assertDb();
    const metrics = database.query("SELECT * FROM room_metrics LIMIT 1").get() as RoomMetrics;
    const thermostat = database.query("SELECT * FROM thermostat_settings WHERE id = 1").get() as ThermostatSettings;

    if (!metrics || !thermostat) {
      return c.html(<ErrorPage title="Service Error" message="Required data unavailable. Please check system configuration." />, 500);
    }

    return c.html(<DashboardPage metrics={metrics} thermostat={thermostat} />);
  });

  // Thermostat page
  app.get("/thermostat", (c) => {
    const database = assertDb();
    const thermostat = database.query("SELECT * FROM thermostat_settings WHERE id = 1").get() as ThermostatSettings;

    if (!thermostat) {
      return c.html(<ErrorPage title="Service Error" message="Thermostat data unavailable. Please check system configuration." />, 500);
    }

    return c.html(<ThermostatPage thermostat={thermostat} />);
  });

  // Inventory page
  app.get("/inventory", (c) => {
    const database = assertDb();
    const items = database.query("SELECT * FROM inventory_item ORDER BY location, item_name").all() as InventoryItem[];
    // Inventory can be empty, no error needed
    return c.html(<InventoryPage items={items} />);
  });

  // Grocery page
  app.get("/grocery", (c) => {
    const database = assertDb();
    const products = database.query("SELECT * FROM grocery_product ORDER BY name").all() as GroceryProduct[];
    // Grocery catalog can be empty, no error needed
    return c.html(<GroceryPage products={products} />);
  });

  // Calendar page
  app.get("/calendar", (c) => {
    const database = assertDb();
    const events = database.query("SELECT * FROM calendar_event ORDER BY start_time").all() as CalendarEvent[];
    // Calendar can be empty, no error needed
    return c.html(<CalendarPage events={events} />);
  });

  // Meal Plan page
  app.get("/meal-plan", (c) => {
    const database = assertDb();
    const constraints = database.query("SELECT * FROM user_constraints WHERE id = 1").get() as UserConstraints;
    const recipes = database.query("SELECT * FROM recipe ORDER BY meal_type, name").all() as Recipe[];

    if (!constraints) {
      return c.html(<ErrorPage title="Service Error" message="Constraints data unavailable. Please check system configuration." />, 500);
    }

    return c.html(<MealPlanPage constraints={constraints} recipes={recipes} />);
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
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
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
    const now = getBenchmarkTime();
    database.query("UPDATE thermostat_settings SET mode = ?, temperature = ?, updated_at = ? WHERE id = 1").run(mode, temperature, now);

    return c.json({ mode, temperature, updated_at: now });
  });

  // Coffee Schedule API
  app.get("/api/coffee-schedule", (c) => {
    const database = assertDb();
    const schedule = database.query("SELECT start_time, updated_at FROM coffee_schedule WHERE id = 1").get() as { start_time: string; updated_at: string };
    const clock = database.query("SELECT current_time FROM benchmark_clock WHERE id = 1").get() as { current_time: string };

    if (!schedule) {
      return c.json({ error: "Coffee schedule not found" }, 404);
    }

    const status = clock ? deriveCoffeeStatus(schedule.start_time, clock.current_time) : "scheduled";
    return c.json({ start_time: schedule.start_time, status, updated_at: schedule.updated_at });
  });

  app.post("/api/coffee-schedule", async (c) => {
    let body: { start_time?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const startTime = body.start_time;
    if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
      return c.json({ error: "Invalid start_time format. Use HH:MM format" }, 400);
    }

    // Validate HH:MM bounds (reject invalid times like 29:99)
    const [hour, min] = startTime.split(":").map(Number);
    if (hour < 0 || hour > 23 || min < 0 || min > 59) {
      return c.json({ error: "Invalid time value. Hour must be 0-23, minute must be 0-59" }, 400);
    }

    const database = assertDb();
    const now = getBenchmarkTime();
    database.query("UPDATE coffee_schedule SET start_time = ?, updated_at = ? WHERE id = 1").run(startTime, now);

    return c.json({ start_time: startTime, updated_at: now });
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
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!body.item_name || typeof body.quantity !== "number" || !body.unit || !body.location) {
      return c.json({ error: "Missing required fields: item_name, quantity, unit, location" }, 400);
    }

    const database = assertDb();
    const result = database.query(
      "INSERT INTO inventory_item (item_name, quantity, unit, location, expiry_date, category) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(body.item_name, body.quantity, body.unit, body.location, body.expiry_date || null, body.category || null);

    return c.json({
      id: result.lastInsertRowid,
      item_name: body.item_name,
      quantity: body.quantity,
      unit: body.unit,
      location: body.location,
      expiry_date: body.expiry_date,
      category: body.category
    }, 201);
  });

  app.delete("/api/inventory/:id", (c) => {
    const id = c.req.param("id");
    const database = assertDb();

    const existing = database.query("SELECT id FROM inventory_item WHERE id = ?").get(id);
    if (!existing) {
      return c.json({ error: "Item not found" }, 404);
    }

    database.query("DELETE FROM inventory_item WHERE id = ?").run(id);
    return c.json({ success: true });
  });

  // Grocery API
  app.get("/api/grocery/products", (c) => {
    const database = assertDb();
    const products = database.query("SELECT product_id, name, price, stock_status, substitute_for FROM grocery_product ORDER BY name").all();
    return c.json(products);
  });

  app.post("/api/grocery/orders", async (c) => {
    let body: { items?: Array<{ product_id: string; quantity: number; substitute_for?: string }> };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const items = body.items;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return c.json({ error: "Items array required" }, 400);
    }

    const database = assertDb();

    // Validate products and calculate total
    let total = 0;
    const orderItems: Array<{ product_id: string; quantity: number; unit_price: number; substitute_for?: string }> = [];

    for (const item of items) {
      if (!item.product_id || typeof item.quantity !== "number" || item.quantity <= 0) {
        return c.json({ error: "Invalid item: product_id and positive quantity required" }, 400);
      }

      const product = database.query("SELECT product_id, name, price, stock_status FROM grocery_product WHERE product_id = ?").get(item.product_id) as GroceryProduct | undefined;
      if (!product) {
        return c.json({ error: `Product not found: ${item.product_id}` }, 404);
      }

      if (product.stock_status === "out_of_stock" && !item.substitute_for) {
        return c.json({ error: `Product out of stock and no substitute provided: ${item.product_id}` }, 409);
      }

      total += product.price * item.quantity;
      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: product.price,
        substitute_for: item.substitute_for
      });
    }

    // Create order with transaction
    const orderId = generateOrderId();
    const now = getBenchmarkTime();

    const createOrder = database.transaction(() => {
      database.query("INSERT INTO grocery_order (order_id, total, created_at) VALUES (?, ?, ?)").run(orderId, total, now);

      for (const orderItem of orderItems) {
        database.query(
          "INSERT INTO grocery_order_item (order_id, product_id, quantity, unit_price, substitute_for) VALUES (?, ?, ?, ?, ?)"
        ).run(orderId, orderItem.product_id, orderItem.quantity, orderItem.unit_price, orderItem.substitute_for || null);
      }
    });

    createOrder();

    return c.json({
      success: true,
      order_id: orderId,
      total: Math.round(total * 100) / 100,
      items: orderItems
    }, 201);
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
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
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

    const now = getBenchmarkTime();
    database.query(
      "UPDATE calendar_event SET title = COALESCE(?, title), start_time = COALESCE(?, start_time), event_type = COALESCE(?, event_type), workout_type = ?, updated_at = ? WHERE id = ?"
    ).run(body.title || null, body.start_time || null, body.event_type || null, body.workout_type ?? null, now, id);

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
    const plan = database.query("SELECT plan_id, created_at, plan_data FROM meal_plan ORDER BY created_at DESC LIMIT 1").get();
    if (!plan) {
      return c.json({ error: "No meal plan found" }, 404);
    }
    return c.json(plan);
  });

  app.post("/api/meal-plan", async (c) => {
    let body: { days?: Array<{ date: string; meals: Array<{ meal_type: string; meal_id: number }> }> };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const days = body.days;
    if (!days || !Array.isArray(days) || days.length !== 7) {
      return c.json({ error: "Exactly 7 days required for weekly meal plan" }, 400);
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
}

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------

const app = createMockApp({
  name: "smarthome",
  port: 5003,
  healthResponse: { ok: true, status: "healthy", service: "smarthome" },
  routes: registerRoutes,
});

startServer(app, {
  seed() {
    initDatabase();
  },
});
