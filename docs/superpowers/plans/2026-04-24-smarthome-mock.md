# Smarthome Mock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a standalone smarthome mock service using SQLite as the single source of truth for all persistent data, ensuring verifiers can query consistent state.

**Architecture:** Single Bun+Hono mock binary with SQLite backend (no JsonStore). Four functional domains (room status, thermostat, coffee machine, inventory/grocery) share one SQLite database file. HTML pages rendered via Hono TSX, API routes return JSON. Database seeded from SQL file at startup.

**Tech Stack:** Bun, Hono, bun:sqlite, TypeScript/TSX

---

## File Structure

```
mock-platform/mocks/smarthome/
├── package.json              # Package config with smarthome-specific deps
├── tsconfig.json             # TypeScript config (extends root)
├── src/
│   ├── index.tsx             # Entry point, route registration, HTML rendering
│   ├── db.ts                 # SQLite initialization, schema, seed data
│   └── types.ts              # TypeScript interfaces for all entities
```

**Database file:** `/var/lib/mock-data/smarthome/smarthome.db` (verifier-readable path)

**Static assets:** None required (inline CSS, no external images)

---

## Task 1: Create Package Structure and Types

**Files:**
- Create: `mock-platform/mocks/smarthome/package.json`
- Create: `mock-platform/mocks/smarthome/tsconfig.json`
- Create: `mock-platform/mocks/smarthome/src/types.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "mock-smarthome",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/index.tsx",
    "build": "bun build --compile --target bun-linux-x64 src/index.tsx --outfile ../../dist/mock-smarthome"
  },
  "dependencies": {
    "hono": "^4.7.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create types.ts with all entity interfaces**

```typescript
// Room status domain
export interface Room {
  id: number;
  room_name: string;
  created_at: string;
  updated_at: string;
}

export interface RoomMetrics {
  id: number;
  room_id: number;
  temperature: number;
  humidity: number;
  noise: number | null;
  light: number | null;
  air_quality: string | null;
  unit_temp: "F" | "C";
  created_at: string;
  updated_at: string;
}

// Thermostat domain
export interface ThermostatSettings {
  id: number;
  mode: "comfort" | "eco" | "off";
  target_temperature: number;
  unit: "F" | "C";
  created_at: string;
  updated_at: string;
}

// Coffee machine domain
export interface CoffeeSchedule {
  id: number;
  start_time: string;
  status: "scheduled" | "paused" | "failed" | "cancelled" | "executed";
  created_at: string;
  updated_at: string;
}

// Inventory & Grocery domain
export interface InventoryItem {
  id: number;
  area: "fridge" | "pantry";
  item_name: string;
  quantity: number;
  unit: string;
  expiry_date: string | null;
  category: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroceryItem {
  id: number;
  item_name: string;
  target_quantity: number;
  unit: string;
  priority: "low" | "normal" | "high";
  status: "pending" | "purchased" | "cancelled";
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: Verify types compile**

Run: `cd mock-platform/mocks/smarthome && bun run --bun tsc --noEmit`
Expected: No errors (types only, no runtime)

- [ ] **Step 5: Commit**

```bash
git add mock-platform/mocks/smarthome/
git commit -m "feat(smarthome): add package structure and type definitions"
```

---

## Task 2: Implement SQLite Database Layer

**Files:**
- Create: `mock-platform/mocks/smarthome/src/db.ts`

- [ ] **Step 1: Create db.ts with schema and seed functions**

```typescript
import { Database } from "bun:sqlite";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import type { Room, RoomMetrics, ThermostatSettings, CoffeeSchedule, InventoryItem, GroceryItem } from "./types";

let _db: Database | null = null;

const DATA_DIR = process.env.MOCK_DATA_DIR || "/var/lib/mock-data/smarthome";
const DB_PATH = join(DATA_DIR, "smarthome.db");
const SQL_SEED_PATH = process.env.MOCK_SQL_SEED_PATH || "/opt/mock/data/smarthome_seed.sql";

export function getDb(): Database {
  if (_db !== null) return _db;

  // Ensure data directory exists
  mkdirSync(dirname(DB_PATH), { recursive: true });

  _db = new Database(DB_PATH, { create: true });

  // Enable WAL mode and foreign keys
  _db.run("PRAGMA journal_mode = WAL");
  _db.run("PRAGMA foreign_keys = ON");

  // Run schema migration
  migrate(_db);

  return _db;
}

function migrate(db: Database): void {
  // Room table
  db.run(`
    CREATE TABLE IF NOT EXISTS room (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Room metrics table
  db.run(`
    CREATE TABLE IF NOT EXISTS room_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      temperature REAL NOT NULL,
      humidity REAL NOT NULL,
      noise REAL,
      light REAL,
      air_quality TEXT,
      unit_temp TEXT NOT NULL DEFAULT 'F',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (room_id) REFERENCES room(id) ON DELETE RESTRICT
    )
  `);

  // Thermostat settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS thermostat_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mode TEXT NOT NULL DEFAULT 'comfort' CHECK(mode IN ('comfort', 'eco', 'off')),
      target_temperature REAL NOT NULL DEFAULT 71,
      unit TEXT NOT NULL DEFAULT 'F',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Coffee schedule table
  db.run(`
    CREATE TABLE IF NOT EXISTS coffee_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'paused', 'failed', 'cancelled', 'executed')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Inventory item table
  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      area TEXT NOT NULL DEFAULT 'fridge' CHECK(area IN ('fridge', 'pantry')),
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL,
      expiry_date TEXT,
      category TEXT,
      location TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Grocery item table
  db.run(`
    CREATE TABLE IF NOT EXISTS grocery_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      target_quantity REAL NOT NULL DEFAULT 1,
      unit TEXT NOT NULL,
      priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high')),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'purchased', 'cancelled')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create indexes for common queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_room_metrics_room_id ON room_metrics(room_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_inventory_item_area ON inventory_item(area)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_grocery_item_status ON grocery_item(status)`);
}

export function seedDatabase(): void {
  const db = getDb();

  // Check if already seeded
  const roomCount = db.query("SELECT COUNT(*) as count FROM room").get() as { count: number };
  if (roomCount.count > 0) {
    console.log("mock-smarthome: database already seeded, skipping");
    return;
  }

  // Try to load external SQL seed file
  if (existsSync(SQL_SEED_PATH)) {
    console.log(`mock-smarthome: loading seed data from ${SQL_SEED_PATH}`);
    const sql = readFileSync(SQL_SEED_PATH, "utf-8");
    db.exec(sql);
    return;
  }

  // Default seed data
  console.log("mock-smarthome: using default seed data");

  // Seed room
  db.run(`INSERT INTO room (room_name) VALUES ('living_room')`);
  const roomId = (db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id;

  // Seed room metrics
  db.run(`
    INSERT INTO room_metrics (room_id, temperature, humidity, noise, light, air_quality, unit_temp)
    VALUES (?, 72.5, 45.0, 35.0, 500.0, 'good', 'F')
  `, [roomId]);

  // Seed thermostat settings
  db.run(`INSERT INTO thermostat_settings (mode, target_temperature, unit) VALUES ('comfort', 71, 'F')`);

  // Seed coffee schedule (tomorrow morning 7:00 AM)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(7, 0, 0, 0);
  db.run(`INSERT INTO coffee_schedule (start_time, status) VALUES (?, 'scheduled')`, [tomorrow.toISOString()]);

  // Seed inventory items
  const inventoryItems: Array<{ area: "fridge" | "pantry"; item_name: string; quantity: number; unit: string; category?: string }> = [
    { area: "fridge", item_name: "Milk", quantity: 2, unit: "gallons", category: "dairy" },
    { area: "fridge", item_name: "Eggs", quantity: 12, unit: "pieces", category: "protein" },
    { area: "fridge", item_name: "Butter", quantity: 1, unit: "lb", category: "dairy" },
    { area: "pantry", item_name: "Rice", quantity: 5, unit: "lb", category: "grains" },
    { area: "pantry", item_name: "Pasta", quantity: 3, unit: "lb", category: "grains" },
    { area: "pantry", item_name: "Olive Oil", quantity: 1, unit: "liter", category: "oils" },
  ];

  const insertInventory = db.prepare(`
    INSERT INTO inventory_item (area, item_name, quantity, unit, category)
    VALUES ($area, $item_name, $quantity, $unit, $category)
  `);

  for (const item of inventoryItems) {
    insertInventory.run({
      $area: item.area,
      $item_name: item.item_name,
      $quantity: item.quantity,
      $unit: item.unit,
      $category: item.category ?? null,
    });
  }

  // Seed grocery items
  const groceryItems: Array<{ item_name: string; target_quantity: number; unit: string; priority: "low" | "normal" | "high" }> = [
    { item_name: "Bread", target_quantity: 1, unit: "loaf", priority: "high" },
    { item_name: "Cheese", target_quantity: 1, unit: "lb", priority: "normal" },
    { item_name: "Tomatoes", target_quantity: 6, unit: "pieces", priority: "normal" },
    { item_name: "Chicken Breast", target_quantity: 2, unit: "lb", priority: "high" },
  ];

  const insertGrocery = db.prepare(`
    INSERT INTO grocery_item (item_name, target_quantity, unit, priority)
    VALUES ($item_name, $target_quantity, $unit, $priority)
  `);

  for (const item of groceryItems) {
    insertGrocery.run({
      $item_name: item.item_name,
      $target_quantity: item.target_quantity,
      $unit: item.unit,
      $priority: item.priority,
    });
  }

  console.log("mock-smarthome: default seed data loaded");
}

export function resetDb(): void {
  if (_db !== null) {
    _db.close();
    _db = null;
  }
}

// Query helpers with type safety
export function getRoomWithMetrics(db: Database, roomId: number): { room: Room; metrics: RoomMetrics } | null {
  const room = db.query("SELECT * FROM room WHERE id = ?").get(roomId) as Room | undefined;
  if (!room) return null;

  const metrics = db.query("SELECT * FROM room_metrics WHERE room_id = ?").get(roomId) as RoomMetrics | undefined;
  if (!metrics) return null;

  return { room, metrics };
}

export function getThermostatSettings(db: Database): ThermostatSettings | null {
  return db.query("SELECT * FROM thermostat_settings ORDER BY id DESC LIMIT 1").get() as ThermostatSettings | undefined ?? null;
}

export function getCoffeeSchedule(db: Database): CoffeeSchedule | null {
  return db.query("SELECT * FROM coffee_schedule WHERE status = 'scheduled' ORDER BY start_time ASC LIMIT 1").get() as CoffeeSchedule | undefined ?? null;
}

export function getInventoryByArea(db: Database, area: "fridge" | "pantry"): InventoryItem[] {
  return db.query("SELECT * FROM inventory_item WHERE area = ? ORDER BY item_name").all(area) as InventoryItem[];
}

export function getGroceryItems(db: Database, status?: "pending" | "purchased" | "cancelled"): GroceryItem[] {
  if (status) {
    return db.query("SELECT * FROM grocery_item WHERE status = ? ORDER BY priority DESC, item_name").all(status) as GroceryItem[];
  }
  return db.query("SELECT * FROM grocery_item ORDER BY status, priority DESC, item_name").all() as GroceryItem[];
}
```

- [ ] **Step 2: Verify db.ts compiles**

Run: `cd mock-platform/mocks/smarthome && bun run --bun tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add mock-platform/mocks/smarthome/src/db.ts
git commit -m "feat(smarthome): add SQLite database layer with schema and seed data"
```

---

## Task 3: Implement HTML Rendering Components

**Files:**
- Modify: `mock-platform/mocks/smarthome/src/index.tsx`

- [ ] **Step 1: Create index.tsx with layout and home page components**

```tsx
/**
 * Smarthome mock service — Smart Home Control Panel
 *
 * Provides four functional domains:
 * - Room status: View environment metrics (temperature, humidity, etc.)
 * - Thermostat: Control mode and target temperature
 * - Coffee machine: Manage scheduled start times
 * - Inventory & Grocery: Manage fridge/pantry items and shopping list
 *
 * Uses SQLite as the single source of truth for all persistent data.
 * Verifiers can query the database directly for consistent state.
 */

import { createMockApp, startServer } from "mock-lib";
import type { AppEnv } from "mock-lib";
import { Hono } from "hono";
import { html, raw } from "hono/html";
import type { FC, Child } from "hono/jsx";
import { getDb, seedDatabase, getRoomWithMetrics, getThermostatSettings, getCoffeeSchedule, getInventoryByArea, getGroceryItems } from "./db.js";
import type { Room, RoomMetrics, ThermostatSettings, CoffeeSchedule, InventoryItem, GroceryItem } from "./types.js";

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
// Shared CSS
// ---------------------------------------------------------------------------

const SHARED_CSS = `
:root { --primary: #4285f4; --success: #34a853; --warning: #fbbc04; --danger: #ea4335; --bg: #f8f9fa; --card: #ffffff; --text: #202124; --muted: #5f6368; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; }
.container { max-width: 1200px; margin: 0 auto; padding: 20px; }
.nav { background: var(--card); padding: 16px 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; gap: 20px; flex-wrap: wrap; }
.nav a { color: var(--primary); text-decoration: none; font-weight: 500; }
.nav a:hover { text-decoration: underline; }
.card { background: var(--card); border-radius: 12px; padding: 24px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.card h2 { margin-bottom: 16px; color: var(--text); }
.btn { display: inline-block; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; text-decoration: none; transition: all 0.2s; }
.btn-primary { background: var(--primary); color: white; }
.btn-primary:hover { background: #3367d6; }
.btn-success { background: var(--success); color: white; }
.btn-danger { background: var(--danger); color: white; }
.btn-outline { background: transparent; border: 2px solid var(--primary); color: var(--primary); }
.btn-outline:hover { background: var(--primary); color: white; }
.metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; }
.metric-item { text-align: center; padding: 16px; background: var(--bg); border-radius: 8px; }
.metric-value { font-size: 32px; font-weight: 600; color: var(--primary); }
.metric-label { font-size: 12px; color: var(--muted); text-transform: uppercase; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 8px; font-weight: 500; }
.form-group input, .form-group select { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; }
.form-group input:focus, .form-group select:focus { outline: none; border-color: var(--primary); }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
.table th { background: var(--bg); font-weight: 600; }
.badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.badge-success { background: #e6f4ea; color: var(--success); }
.badge-warning { background: #fef7e0; color: #b45309; }
.badge-danger { background: #fce8e6; color: var(--danger); }
.badge-info { background: #e8f0fe; color: var(--primary); }
.actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
`;

// ---------------------------------------------------------------------------
// Layout Component
// ---------------------------------------------------------------------------

const Layout: FC<{ title: string; children: Child; scripts?: string }> = ({ title, children, scripts }) => {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title} - Smart Home</title>
<style>${raw(SHARED_CSS)}</style>
</head>
<body>
<nav class="nav">
<a href="/">Home</a>
<a href="/thermostat">Thermostat</a>
<a href="/coffee">Coffee Machine</a>
<a href="/inventory">Inventory</a>
<a href="/grocery">Grocery List</a>
</nav>
<div class="container">
${children}
</div>
${scripts ? html`<script>${raw(scripts)}</script>` : ""}
</body>
</html>`;
};

// ---------------------------------------------------------------------------
// Home Page - Room Status
// ---------------------------------------------------------------------------

const MetricCard: FC<{ label: string; value: string | number; unit?: string }> = ({ label, value, unit }) => {
  return <div class="metric-item">
    <div class="metric-value">{value}{unit ? <span style="font-size: 16px;">{unit}</span> : ""}</div>
    <div class="metric-label">{label}</div>
  </div>;
};

const HomePage: FC<{ room: Room; metrics: RoomMetrics }> = ({ room, metrics }) => {
  const roomDisplayName = room.room_name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return <Layout title="Smart Home">
    <div class="card">
      <h2>{roomDisplayName} - Environment Overview</h2>
      <div class="metric-grid">
        <MetricCard label="Temperature" value={metrics.temperature.toFixed(1)} unit={metrics.unit_temp} />
        <MetricCard label="Humidity" value={metrics.humidity.toFixed(0)} unit="%" />
        {metrics.noise !== null ? <MetricCard label="Noise" value={metrics.noise.toFixed(0)} unit="dB" /> : null}
        {metrics.light !== null ? <MetricCard label="Light" value={metrics.light.toFixed(0)} unit="lux" /> : null}
        {metrics.air_quality !== null ? <MetricCard label="Air Quality" value={metrics.air_quality} /> : null}
      </div>
    </div>
    <div class="card">
      <h2>Quick Actions</h2>
      <div class="actions">
        <a href="/thermostat" class="btn btn-primary">Manage Thermostat</a>
        <a href="/coffee" class="btn btn-outline">Coffee Machine</a>
        <a href="/inventory" class="btn btn-outline">View Inventory</a>
        <a href="/grocery" class="btn btn-outline">Grocery List</a>
      </div>
    </div>
  </Layout>;
};

// ---------------------------------------------------------------------------
// Thermostat Page
// ---------------------------------------------------------------------------

const ThermostatPage: FC<{ settings: ThermostatSettings }> = ({ settings }) => {
  const modeLabels: Record<string, string> = { comfort: "Comfort", eco: "Eco", off: "Off" };
  const modeBadgeClass: Record<string, string> = { comfort: "badge-success", eco: "badge-info", off: "badge-warning" };

  return <Layout title="Thermostat" scripts={`
async function updateThermostat() {
  const mode = document.getElementById('mode').value;
  const temp = document.getElementById('temperature').value;
  try {
    const response = await fetch('/api/thermostat', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, target_temperature: parseFloat(temp) })
    });
    const data = await response.json();
    if (data.success) {
      alert('Thermostat updated successfully!');
      location.reload();
    } else {
      alert('Failed to update: ' + data.error);
    }
  } catch (error) {
    console.error('Error updating thermostat:', error);
    alert('Error updating thermostat');
  }
}
`}>
    <div class="card">
      <h2>Thermostat Settings</h2>
      <p>Current Mode: <span class={"badge " + modeBadgeClass[settings.mode]}>{modeLabels[settings.mode]}</span></p>
      <p>Target Temperature: <strong>{settings.target_temperature}{settings.unit}</strong></p>
    </div>
    <div class="card">
      <h2>Adjust Settings</h2>
      <div class="form-group">
        <label for="mode">Mode</label>
        <select id="mode">
          <option value="comfort" selected={settings.mode === "comfort"}>Comfort (71{settings.unit})</option>
          <option value="eco" selected={settings.mode === "eco"}>Eco (78{settings.unit})</option>
          <option value="off" selected={settings.mode === "off"}>Off</option>
        </select>
      </div>
      <div class="form-group">
        <label for="temperature">Target Temperature ({settings.unit})</label>
        <input type="number" id="temperature" value={settings.target_temperature} min="60" max="90" step="1" />
      </div>
      <button class="btn btn-primary" onclick="updateThermostat()">Save Changes</button>
    </div>
    <div class="actions">
      <a href="/" class="btn btn-outline">Back to Home</a>
    </div>
  </Layout>;
};

// ---------------------------------------------------------------------------
// Coffee Machine Page
// ---------------------------------------------------------------------------

const CoffeePage: FC<{ schedule: CoffeeSchedule | null }> = ({ schedule }) => {
  const statusBadgeClass: Record<string, string> = {
    scheduled: "badge-success",
    paused: "badge-warning",
    failed: "badge-danger",
    cancelled: "badge-warning",
    executed: "badge-info",
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  };

  return <Layout title="Coffee Machine" scripts={`
async function updateCoffeeSchedule() {
  const newTime = document.getElementById('start_time').value;
  if (!newTime) {
    alert('Please select a new start time');
    return;
  }
  try {
    const response = await fetch('/api/coffee/schedule', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_time: new Date(newTime).toISOString() })
    });
    const data = await response.json();
    if (data.success) {
      alert('Coffee schedule updated!');
      location.reload();
    } else {
      alert('Failed to update: ' + data.error);
    }
  } catch (error) {
    console.error('Error updating schedule:', error);
    alert('Error updating schedule');
  }
}
`}>
    <div class="card">
      <h2>Coffee Machine Schedule</h2>
      {schedule
        ? <>
            <p>Next Scheduled: <strong>{formatTime(schedule.start_time)}</strong></p>
            <p>Status: <span class={"badge " + statusBadgeClass[schedule.status]}>{schedule.status}</span></p>
          </>
        : <p>No scheduled coffee time. Set one below.</p>
      }
    </div>
    <div class="card">
      <h2>Reschedule Coffee</h2>
      <p style="color: var(--muted); font-size: 14px; margin-bottom: 16px;">New time must be at least 20 minutes from now.</p>
      <div class="form-group">
        <label for="start_time">New Start Time</label>
        <input type="datetime-local" id="start_time" />
      </div>
      <button class="btn btn-primary" onclick="updateCoffeeSchedule()">Update Schedule</button>
    </div>
    <div class="actions">
      <a href="/" class="btn btn-outline">Back to Home</a>
    </div>
  </Layout>;
};

// ---------------------------------------------------------------------------
// Inventory Page
// ---------------------------------------------------------------------------

const InventoryPage: FC<{ fridgeItems: InventoryItem[]; pantryItems: InventoryItem[] }> = ({ fridgeItems, pantryItems }) => {
  const renderTable = (items: InventoryItem[], title: string) => {
    if (items.length === 0) {
      return <div class="card"><h2>{title}</h2><p>No items.</p></div>;
    }

    const rows: Child[] = items.map((item) => {
      const expiryBadge = item.expiry_date
        ? new Date(item.expiry_date) < new Date()
          ? <span class="badge badge-danger">Expired</span>
          : <span class="badge badge-warning">{new Date(item.expiry_date).toLocaleDateString()}</span>
        : null;

      return <tr>
        <td>{item.item_name}</td>
        <td>{item.quantity} {item.unit}</td>
        <td>{item.category ?? "-"}</td>
        <td>{item.location ?? "-"}</td>
        <td>{expiryBadge}</td>
        <td>
          <button class="btn btn-outline" style="padding: 4px 8px; font-size: 12px;" onclick={`editInventory(${item.id})`}>Edit</button>
          {" "}
          <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick={`deleteInventory(${item.id})`}>Delete</button>
        </td>
      </tr>;
    });

    return <div class="card">
      <h2>{title}</h2>
      <table class="table">
        <thead><tr><th>Item</th><th>Quantity</th><th>Category</th><th>Location</th><th>Expiry</th><th>Actions</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>;
  };

  return <Layout title="Inventory" scripts={`
async function editInventory(id) {
  const newQty = prompt('Enter new quantity:');
  if (newQty === null) return;
  try {
    const response = await fetch('/api/inventory/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: parseFloat(newQty) })
    });
    const data = await response.json();
    if (data.success) location.reload();
    else alert('Failed: ' + data.error);
  } catch (error) { alert('Error updating item'); }
}
async function deleteInventory(id) {
  if (!confirm('Delete this item?')) return;
  try {
    const response = await fetch('/api/inventory/' + id, { method: 'DELETE' });
    const data = await response.json();
    if (data.success) location.reload();
    else alert('Failed: ' + data.error);
  } catch (error) { alert('Error deleting item'); }
}
async function addInventory() {
  const area = document.getElementById('new_area').value;
  const name = document.getElementById('new_name').value;
  const qty = document.getElementById('new_qty').value;
  const unit = document.getElementById('new_unit').value;
  if (!name || !qty || !unit) { alert('Fill all required fields'); return; }
  try {
    const response = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area, item_name: name, quantity: parseFloat(qty), unit })
    });
    const data = await response.json();
    if (data.success) location.reload();
    else alert('Failed: ' + data.error);
  } catch (error) { alert('Error adding item'); }
}
`}>
    {renderTable(fridgeItems, "Fridge")}
    {renderTable(pantryItems, "Pantry")}
    <div class="card">
      <h2>Add New Item</h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label for="new_area">Area</label>
          <select id="new_area"><option value="fridge">Fridge</option><option value="pantry">Pantry</option></select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label for="new_name">Item Name</label>
          <input type="text" id="new_name" placeholder="e.g., Milk" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label for="new_qty">Quantity</label>
          <input type="number" id="new_qty" min="0" step="0.1" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label for="new_unit">Unit</label>
          <input type="text" id="new_unit" placeholder="e.g., gallons" />
        </div>
      </div>
      <button class="btn btn-primary" style="margin-top: 16px;" onclick="addInventory()">Add Item</button>
    </div>
    <div class="actions">
      <a href="/" class="btn btn-outline">Back to Home</a>
    </div>
  </Layout>;
};

// ---------------------------------------------------------------------------
// Grocery List Page
// ---------------------------------------------------------------------------

const GroceryPage: FC<{ items: GroceryItem[] }> = ({ items }) => {
  const priorityBadgeClass: Record<string, string> = { high: "badge-danger", normal: "badge-info", low: "badge-warning" };
  const statusBadgeClass: Record<string, string> = { pending: "badge-warning", purchased: "badge-success", cancelled: "badge-danger" };

  const rows: Child[] = items.map((item) => {
    return <tr>
      <td>{item.item_name}</td>
      <td>{item.target_quantity} {item.unit}</td>
      <td><span class={"badge " + priorityBadgeClass[item.priority]}>{item.priority}</span></td>
      <td><span class={"badge " + statusBadgeClass[item.status]}>{item.status}</span></td>
      <td>
        {item.status === "pending"
          ? <>
              <button class="btn btn-success" style="padding: 4px 8px; font-size: 12px;" onclick={`markPurchased(${item.id})`}>Purchased</button>
              {" "}
              <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick={`cancelGrocery(${item.id})`}>Cancel</button>
            </>
          : "-"}
      </td>
    </tr>;
  });

  return <Layout title="Grocery List" scripts={`
async function markPurchased(id) {
  try {
    const response = await fetch('/api/grocery/' + id + '/purchased', { method: 'POST' });
    const data = await response.json();
    if (data.success) location.reload();
    else alert('Failed: ' + data.error);
  } catch (error) { alert('Error updating item'); }
}
async function cancelGrocery(id) {
  if (!confirm('Cancel this item?')) return;
  try {
    const response = await fetch('/api/grocery/' + id + '/cancel', { method: 'POST' });
    const data = await response.json();
    if (data.success) location.reload();
    else alert('Failed: ' + data.error);
  } catch (error) { alert('Error updating item'); }
}
async function addGrocery() {
  const name = document.getElementById('new_name').value;
  const qty = document.getElementById('new_qty').value;
  const unit = document.getElementById('new_unit').value;
  const priority = document.getElementById('new_priority').value;
  if (!name || !qty || !unit) { alert('Fill all required fields'); return; }
  try {
    const response = await fetch('/api/grocery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name: name, target_quantity: parseFloat(qty), unit, priority })
    });
    const data = await response.json();
    if (data.success) location.reload();
    else alert('Failed: ' + data.error);
  } catch (error) { alert('Error adding item'); }
}
`}>
    <div class="card">
      <h2>Grocery List</h2>
      {items.length > 0
        ? <table class="table">
            <thead><tr><th>Item</th><th>Quantity</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{rows}</tbody>
          </table>
        : <p>No items in grocery list.</p>
      }
    </div>
    <div class="card">
      <h2>Add New Item</h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label for="new_name">Item Name</label>
          <input type="text" id="new_name" placeholder="e.g., Bread" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label for="new_qty">Quantity</label>
          <input type="number" id="new_qty" min="0" step="0.1" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label for="new_unit">Unit</label>
          <input type="text" id="new_unit" placeholder="e.g., loaf" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label for="new_priority">Priority</label>
          <select id="new_priority"><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select>
        </div>
      </div>
      <button class="btn btn-primary" style="margin-top: 16px;" onclick="addGrocery()">Add Item</button>
    </div>
    <div class="actions">
      <a href="/" class="btn btn-outline">Back to Home</a>
    </div>
  </Layout>;
};

// ---------------------------------------------------------------------------
// Route registration (continued in Task 4)
// ---------------------------------------------------------------------------

function registerRoutes(app: Hono<AppEnv>): void {
  // Sentinel route for binary isolation verification
  app.get("/__mock_sentinel__/smarthome", (c) =>
    c.json({ mock: "smarthome", sentinel: true }),
  );

  // HTML pages
  app.get("/", (c) => {
    const db = getDb();
    const data = getRoomWithMetrics(db, 1);
    if (!data) return c.json({ error: "No room data found" }, 500);
    return c.html(<HomePage room={data.room} metrics={data.metrics} />);
  });

  app.get("/thermostat", (c) => {
    const db = getDb();
    const settings = getThermostatSettings(db);
    if (!settings) return c.json({ error: "No thermostat settings found" }, 500);
    return c.html(<ThermostatPage settings={settings} />);
  });

  app.get("/coffee", (c) => {
    const db = getDb();
    const schedule = getCoffeeSchedule(db);
    return c.html(<CoffeePage schedule={schedule} />);
  });

  app.get("/inventory", (c) => {
    const db = getDb();
    const fridgeItems = getInventoryByArea(db, "fridge");
    const pantryItems = getInventoryByArea(db, "pantry");
    return c.html(<InventoryPage fridgeItems={fridgeItems} pantryItems={pantryItems} />);
  });

  app.get("/grocery", (c) => {
    const db = getDb();
    const items = getGroceryItems(db);
    return c.html(<GroceryPage items={items} />);
  });

  // API routes will be added in Task 4
}

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------

const app = createMockApp({
  name: "smarthome",
  port: 5678,
  routes: registerRoutes,
});

startServer(app, {
  seed() {
    seedDatabase();
    console.log(`mock-smarthome: DB=${process.env.MOCK_DATA_DIR || "/var/lib/mock-data/smarthome"}/smarthome.db`);
  },
});
```

- [ ] **Step 2: Verify index.tsx compiles**

Run: `cd mock-platform/mocks/smarthome && bun run --bun tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add mock-platform/mocks/smarthome/src/index.tsx
git commit -m "feat(smarthome): add HTML rendering components for all domains"
```

---

## Task 4: Implement API Routes

**Files:**
- Modify: `mock-platform/mocks/smarthome/src/index.tsx` (add API routes before the closing brace of `registerRoutes`)

- [ ] **Step 1: Add API routes to registerRoutes function**

Add the following code inside `registerRoutes` function, after the HTML page routes:

```typescript
  // ---------------------------------------------------------------------------
  // API Routes
  // ---------------------------------------------------------------------------

  // Thermostat API
  app.get("/api/thermostat", (c) => {
    const db = getDb();
    const settings = getThermostatSettings(db);
    if (!settings) return c.json({ error: "No thermostat settings found" }, 404);
    return c.json(settings);
  });

  app.put("/api/thermostat", async (c) => {
    let body: { mode?: string; target_temperature?: number };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const db = getDb();
    const current = getThermostatSettings(db);
    if (!current) return c.json({ error: "No thermostat settings found" }, 404);

    const mode = body.mode ?? current.mode;
    const temp = body.target_temperature ?? current.target_temperature;

    if (!["comfort", "eco", "off"].includes(mode)) {
      return c.json({ error: "Invalid mode. Must be comfort, eco, or off" }, 400);
    }

    if (typeof temp !== "number" || temp < 60 || temp > 90) {
      return c.json({ error: "Temperature must be between 60 and 90" }, 400);
    }

    db.run(
      "UPDATE thermostat_settings SET mode = ?, target_temperature = ?, updated_at = datetime('now') WHERE id = ?",
      [mode, temp, current.id]
    );

    return c.json({ success: true, settings: { ...current, mode, target_temperature: temp } });
  });

  // Coffee Schedule API
  app.get("/api/coffee/schedule", (c) => {
    const db = getDb();
    const schedule = getCoffeeSchedule(db);
    return c.json(schedule ?? { error: "No scheduled coffee" });
  });

  app.put("/api/coffee/schedule", async (c) => {
    let body: { start_time?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!body.start_time) {
      return c.json({ error: "start_time is required" }, 400);
    }

    const newTime = new Date(body.start_time);
    const now = new Date();
    const minTime = new Date(now.getTime() + 20 * 60 * 1000); // 20 minutes from now

    if (isNaN(newTime.getTime())) {
      return c.json({ error: "Invalid start_time format" }, 400);
    }

    if (newTime < minTime) {
      return c.json({ error: "start_time must be at least 20 minutes in the future" }, 400);
    }

    const db = getDb();
    const current = getCoffeeSchedule(db);

    if (current) {
      db.run(
        "UPDATE coffee_schedule SET start_time = ?, updated_at = datetime('now') WHERE id = ?",
        [newTime.toISOString(), current.id]
      );
      return c.json({ success: true, schedule: { ...current, start_time: newTime.toISOString() } });
    } else {
      db.run(
        "INSERT INTO coffee_schedule (start_time, status) VALUES (?, 'scheduled')",
        [newTime.toISOString()]
      );
      return c.json({ success: true, schedule: { id: 1, start_time: newTime.toISOString(), status: "scheduled" } });
    }
  });

  // Inventory API
  app.get("/api/inventory", (c) => {
    const db = getDb();
    const area = c.req.query("area") as "fridge" | "pantry" | undefined;
    if (area && !["fridge", "pantry"].includes(area)) {
      return c.json({ error: "Invalid area. Must be fridge or pantry" }, 400);
    }

    const items = area ? getInventoryByArea(db, area) : [
      ...getInventoryByArea(db, "fridge"),
      ...getInventoryByArea(db, "pantry")
    ];
    return c.json({ items, total: items.length });
  });

  app.post("/api/inventory", async (c) => {
    let body: { area?: string; item_name?: string; quantity?: number; unit?: string; category?: string; location?: string; expiry_date?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!body.item_name || body.quantity === undefined || !body.unit) {
      return c.json({ error: "item_name, quantity, and unit are required" }, 400);
    }

    const area = (body.area as "fridge" | "pantry") ?? "fridge";
    if (!["fridge", "pantry"].includes(area)) {
      return c.json({ error: "Invalid area. Must be fridge or pantry" }, 400);
    }

    const db = getDb();
    const result = db.run(
      `INSERT INTO inventory_item (area, item_name, quantity, unit, category, location, expiry_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [area, body.item_name, body.quantity, body.unit, body.category ?? null, body.location ?? null, body.expiry_date ?? null]
    );

    return c.json({
      success: true,
      item: {
        id: result.lastInsertRowid,
        area,
        item_name: body.item_name,
        quantity: body.quantity,
        unit: body.unit,
        category: body.category ?? null,
        location: body.location ?? null,
        expiry_date: body.expiry_date ?? null,
      }
    });
  });

  app.put("/api/inventory/:id", async (c) => {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);

    let body: { quantity?: number; item_name?: string; unit?: string; category?: string; location?: string; expiry_date?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const db = getDb();
    const existing = db.query("SELECT * FROM inventory_item WHERE id = ?").get(id) as InventoryItem | undefined;
    if (!existing) return c.json({ error: "Item not found" }, 404);

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.quantity !== undefined) {
      updates.push("quantity = ?");
      values.push(body.quantity);
    }
    if (body.item_name) {
      updates.push("item_name = ?");
      values.push(body.item_name);
    }
    if (body.unit) {
      updates.push("unit = ?");
      values.push(body.unit);
    }
    if (body.category !== undefined) {
      updates.push("category = ?");
      values.push(body.category);
    }
    if (body.location !== undefined) {
      updates.push("location = ?");
      values.push(body.location);
    }
    if (body.expiry_date !== undefined) {
      updates.push("expiry_date = ?");
      values.push(body.expiry_date);
    }

    if (updates.length === 0) {
      return c.json({ success: true, item: existing });
    }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    db.run(`UPDATE inventory_item SET ${updates.join(", ")} WHERE id = ?`, values);

    return c.json({ success: true });
  });

  app.delete("/api/inventory/:id", (c) => {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);

    const db = getDb();
    const existing = db.query("SELECT * FROM inventory_item WHERE id = ?").get(id);
    if (!existing) return c.json({ error: "Item not found" }, 404);

    db.run("DELETE FROM inventory_item WHERE id = ?", [id]);
    return c.json({ success: true });
  });

  // Grocery API
  app.get("/api/grocery", (c) => {
    const db = getDb();
    const status = c.req.query("status") as "pending" | "purchased" | "cancelled" | undefined;
    if (status && !["pending", "purchased", "cancelled"].includes(status)) {
      return c.json({ error: "Invalid status" }, 400);
    }

    const items = getGroceryItems(db, status);
    return c.json({ items, total: items.length });
  });

  app.post("/api/grocery", async (c) => {
    let body: { item_name?: string; target_quantity?: number; unit?: string; priority?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!body.item_name || body.target_quantity === undefined || !body.unit) {
      return c.json({ error: "item_name, target_quantity, and unit are required" }, 400);
    }

    const priority = (body.priority as "low" | "normal" | "high") ?? "normal";
    if (!["low", "normal", "high"].includes(priority)) {
      return c.json({ error: "Invalid priority. Must be low, normal, or high" }, 400);
    }

    const db = getDb();
    const result = db.run(
      "INSERT INTO grocery_item (item_name, target_quantity, unit, priority, status) VALUES (?, ?, ?, ?, 'pending')",
      [body.item_name, body.target_quantity, body.unit, priority]
    );

    return c.json({
      success: true,
      item: {
        id: result.lastInsertRowid,
        item_name: body.item_name,
        target_quantity: body.target_quantity,
        unit: body.unit,
        priority,
        status: "pending",
      }
    });
  });

  app.post("/api/grocery/:id/purchased", (c) => {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);

    const db = getDb();
    const existing = db.query("SELECT * FROM grocery_item WHERE id = ?").get(id) as GroceryItem | undefined;
    if (!existing) return c.json({ error: "Item not found" }, 404);

    db.run("UPDATE grocery_item SET status = 'purchased', updated_at = datetime('now') WHERE id = ?", [id]);
    return c.json({ success: true });
  });

  app.post("/api/grocery/:id/cancel", (c) => {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);

    const db = getDb();
    const existing = db.query("SELECT * FROM grocery_item WHERE id = ?").get(id) as GroceryItem | undefined;
    if (!existing) return c.json({ error: "Item not found" }, 404);

    db.run("UPDATE grocery_item SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?", [id]);
    return c.json({ success: true });
  });

  app.delete("/api/grocery/:id", (c) => {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);

    const db = getDb();
    const existing = db.query("SELECT * FROM grocery_item WHERE id = ?").get(id);
    if (!existing) return c.json({ error: "Item not found" }, 404);

    db.run("DELETE FROM grocery_item WHERE id = ?", [id]);
    return c.json({ success: true });
  });
```

- [ ] **Step 2: Verify full compilation**

Run: `cd mock-platform/mocks/smarthome && bun run --bun tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add mock-platform/mocks/smarthome/src/index.tsx
git commit -m "feat(smarthome): add complete API routes for all domains"
```

---

## Task 5: Register Mock in Build System

**Files:**
- Modify: `mock-platform/config/task-binary-map.json`
- Modify: `mock-platform/scripts/build-all.ts`

- [ ] **Step 1: Add smarthome to task-binary-map.json binaries list**

Update the `binaries` array in `mock-platform/config/task-binary-map.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "task-binary-map",
  "description": "Task to mock binary mapping for LiveClawBench per-task Docker images",
  "version": "1.2",
  "binaries": ["airline", "email", "shop", "smarthome", "todolist", "doc-search"],
  "tasks": {
    ...existing tasks...
  }
}
```

- [ ] **Step 2: Add smarthome sentinel pattern to build-all.ts**

In `mock-platform/scripts/build-all.ts`, add the smarthome sentinel to the `sentinelPatterns` object:

```typescript
  const sentinelPatterns: Record<string, string> = {
    airline: "/__mock_sentinel__/airline",
    email: "/__mock_sentinel__/email",
    shop: "/__mock_sentinel__/shop",
    smarthome: "/__mock_sentinel__/smarthome",
    todolist: "/__mock_sentinel__/todolist",
    "doc-search": "/__mock_sentinel__/doc-search",
  };
```

- [ ] **Step 3: Build the smarthome mock binary**

Run: `cd mock-platform && bun run build`
Expected: `mock-smarthome` binary created in `dist/`, isolation verification passes

- [ ] **Step 4: Verify binary isolation**

Run: `strings dist/mock-smarthome | grep -E "__mock_sentinel__"`
Expected: Only `/__mock_sentinel__/smarthome` appears, no other sentinel routes

- [ ] **Step 5: Commit**

```bash
git add mock-platform/config/task-binary-map.json mock-platform/scripts/build-all.ts
git commit -m "feat(smarthome): register mock in build system and task-binary-map"
```

---

## Task 6: Test Mock Locally

**Files:**
- None (runtime verification)

- [ ] **Step 1: Start the mock service**

Run: `cd mock-platform && MOCK_DATA_DIR=/tmp/smarthome-test ./dist/mock-smarthome --port 5678`
Expected: Server starts, logs `mock-smarthome listening on http://localhost:5678`

- [ ] **Step 2: Test health endpoint**

Run: `curl http://localhost:5678/health`
Expected: `{"ok":true,"status":"healthy","service":"smarthome"}`

- [ ] **Step 3: Test sentinel endpoint**

Run: `curl http://localhost:5678/__mock_sentinel__/smarthome`
Expected: `{"mock":"smarthome","sentinel":true}`

- [ ] **Step 4: Test home page**

Run: `curl -s http://localhost:5678/ | head -20`
Expected: HTML page with "Smart Home" title and environment metrics

- [ ] **Step 5: Test thermostat API**

Run: `curl http://localhost:5678/api/thermostat`
Expected: JSON with `{"id":1,"mode":"comfort","target_temperature":71,...}`

- [ ] **Step 6: Test thermostat update**

Run: `curl -X PUT http://localhost:5678/api/thermostat -H "Content-Type: application/json" -d '{"mode":"eco","target_temperature":78}'`
Expected: `{"success":true,"settings":{...}}`

- [ ] **Step 7: Verify SQLite database was created**

Run: `sqlite3 /tmp/smarthome-test/smarthome.db "SELECT * FROM thermostat_settings"`
Expected: Row with mode="eco", target_temperature=78

- [ ] **Step 8: Test inventory API**

Run: `curl http://localhost:5678/api/inventory?area=fridge`
Expected: JSON with `{"items":[...],"total":3}` (Milk, Eggs, Butter)

- [ ] **Step 9: Test grocery API**

Run: `curl http://localhost:5678/api/grocery`
Expected: JSON with `{"items":[...],"total":4}` (Bread, Cheese, Tomatoes, Chicken Breast)

- [ ] **Step 10: Stop the mock service**

Run: `pkill -f mock-smarthome` or Ctrl+C in the terminal running the mock

- [ ] **Step 11: Commit verification**

```bash
git add -A
git commit -m "test(smarthome): verify mock service endpoints and SQLite persistence"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- [x] Room status domain: `room` and `room_metrics` tables, home page displays metrics
- [x] Thermostat domain: `thermostat_settings` table, `/thermostat` page and `/api/thermostat` routes
- [x] Coffee machine domain: `coffee_schedule` table, `/coffee` page and `/api/coffee/schedule` routes
- [x] Inventory domain: `inventory_item` table with fridge/pantry areas, `/inventory` page and `/api/inventory` routes
- [x] Grocery domain: `grocery_item` table, `/grocery` page and `/api/grocery` routes
- [x] SQLite as single source of truth: No JsonStore usage, all data in `smarthome.db`
- [x] Verifier can query database directly: DB at `/var/lib/mock-data/smarthome/smarthome.db`

**2. Placeholder scan:**
- [x] No "TBD", "TODO", "implement later" placeholders
- [x] All code blocks contain complete implementations
- [x] All test commands have expected outputs

**3. Type consistency:**
- [x] `ThermostatSettings` interface matches DB schema and API responses
- [x] `CoffeeSchedule` interface matches DB schema and API responses
- [x] `InventoryItem` interface matches DB schema and API responses
- [x] `GroceryItem` interface matches DB schema and API responses

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-24-smarthome-mock.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
