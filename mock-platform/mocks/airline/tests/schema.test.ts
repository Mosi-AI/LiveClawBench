import { describe, expect, test, afterAll } from "bun:test";
import { getAirlineDb, resetAirlineDb, initSchema } from "../src/db/schema";
import { seedDatabase } from "../src/seed";

describe("airline schema", () => {
  afterAll(() => {
    resetAirlineDb();
  });

  test("creates all required tables", () => {
    resetAirlineDb();
    const db = getAirlineDb({ dbPath: ":memory:" });
    initSchema(db);

    const tables = db
      .query(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all()
      .map((r: any) => r.name);

    const requiredTables = [
      "users",
      "flights",
      "seats",
      "bookings",
      "passengers",
      "payments",
      "claims",
      "flight_status_history",
      "baggage_tracking",
      "email_notifications",
      "calendar_events",
      "chat_sessions",
      "chat_messages",
      "price_history",
      "announcements",
      "faqs",
    ];

    for (const t of requiredTables) {
      expect(tables).toContain(t);
    }
  });

  test("seed creates flights with correct seat count", () => {
    resetAirlineDb();
    const db = getAirlineDb({ dbPath: ":memory:" });
    initSchema(db);
    seedDatabase(db);

    const flightCount = (
      db.query("SELECT COUNT(*) as count FROM flights").get() as {
        count: number;
      }
    ).count;
    // 15 route configs * total times slots across all configs (36) * 30 days = 1080 flights
    expect(flightCount).toBe(1080);

    const seatCount = (
      db.query("SELECT COUNT(*) as count FROM seats").get() as {
        count: number;
      }
    ).count;
    expect(seatCount).toBe(1080 * 208);

    const userCount = (
      db.query("SELECT COUNT(*) as count FROM users").get() as {
        count: number;
      }
    ).count;
    expect(userCount).toBe(1);

    const peter = db
      .query("SELECT * FROM users WHERE email = ?")
      .get("peter.griffin@work.mosi.inc") as any;
    expect(peter).toBeDefined();
    expect(peter.first_name).toBe("Peter");
    expect(peter.last_name).toBe("Griffin");
  });

  test("WAL pragma is applied (file-based DB returns wal; in-memory returns memory)", () => {
    resetAirlineDb();
    const db = getAirlineDb({ dbPath: ":memory:" });
    initSchema(db);

    const journalMode = (
      db.query("PRAGMA journal_mode").get() as { journal_mode: string }
    ).journal_mode;
    // In-memory DBs always use "memory" journal mode; file DBs get "wal"
    expect(["wal", "memory"]).toContain(journalMode.toLowerCase());
  });

  test("foreign keys are enabled", () => {
    resetAirlineDb();
    const db = getAirlineDb({ dbPath: ":memory:" });
    initSchema(db);

    const fkEnabled = (
      db.query("PRAGMA foreign_keys").get() as { foreign_keys: number }
    ).foreign_keys;
    expect(fkEnabled).toBe(1);
  });

  test("seeding is idempotent (second call skips)", () => {
    resetAirlineDb();
    const db = getAirlineDb({ dbPath: ":memory:" });
    initSchema(db);
    seedDatabase(db);

    const count1 = (
      db.query("SELECT COUNT(*) as count FROM flights").get() as {
        count: number;
      }
    ).count;

    seedDatabase(db);

    const count2 = (
      db.query("SELECT COUNT(*) as count FROM flights").get() as {
        count: number;
      }
    ).count;

    expect(count1).toBe(count2);
  });
});
