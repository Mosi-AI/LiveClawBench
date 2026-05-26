import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

describe("smarthome schema migrations", () => {
  test("adds status to legacy calendar_event tables", () => {
    const tempDataDir = mkdtempSync(resolve(tmpdir(), "smarthome-mock-legacy-calendar-"));
    const modulePath = resolve(import.meta.dir, "../src/index.tsx");

    const script = `
      import { Database } from "bun:sqlite";
      const dataDir = Bun.argv[2];
      const db = new Database(dataDir + "/smarthome.db", { create: true });
      db.exec(\`
        CREATE TABLE thermostat_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          mode TEXT NOT NULL CHECK (mode IN ('comfort', 'eco', 'off')),
          temperature REAL NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE coffee_schedule (
          schedule_date TEXT PRIMARY KEY,
          start_time TEXT NOT NULL,
          beans_grams INTEGER DEFAULT 20,
          cancelled INTEGER DEFAULT 0,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE benchmark_clock (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          clock_time TEXT NOT NULL
        );
        CREATE TABLE calendar_event (
          id INTEGER PRIMARY KEY,
          title TEXT NOT NULL,
          start_time TEXT NOT NULL,
          event_type TEXT,
          workout_type TEXT CHECK (workout_type IN ('hiit', 'yoga', 'walking', 'cycling', 'strength', 'swimming', 'rest') OR workout_type IS NULL),
          updated_at TEXT NOT NULL
        );
        INSERT INTO thermostat_settings VALUES (1, 'eco', 72.0, '2026-05-09T07:00:00Z');
        INSERT INTO coffee_schedule VALUES ('2026-05-09', '07:00', 20, 0, '2026-05-09T07:00:00Z');
        INSERT INTO benchmark_clock VALUES (1, '2026-05-09T07:45:00Z');
        INSERT INTO calendar_event VALUES (1, 'HIIT Workout', '2026-05-09T09:00:00Z', 'workout', 'hiit', '2026-05-09T07:00:00Z');
      \`);
      db.close();

      process.env.MOCK_DATA_DIR = dataDir;
      delete process.env.MOCK_SEED_PATH;
      const { createSmarthomeApp } = await import(Bun.argv[1]);
      const mockApp = createSmarthomeApp();
      mockApp.seed?.();
      const migrated = new Database(dataDir + "/smarthome.db");
      const row = migrated.query("SELECT status FROM calendar_event WHERE id = 1").get();
      if (row?.status !== "undone") {
        throw new Error("expected migrated status to be undone, got " + JSON.stringify(row));
      }
    `;

    const result = Bun.spawnSync({
      cmd: ["bun", "-e", script, modulePath, tempDataDir],
      cwd: resolve(import.meta.dir, "../../../.."),
      stderr: "pipe",
      stdout: "pipe",
    });

    expect(result.exitCode).toBe(0);
  });
});
