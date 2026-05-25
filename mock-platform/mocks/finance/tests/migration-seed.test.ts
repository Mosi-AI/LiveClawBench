import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { _resetSecret } from "mock-lib";
import { createFinanceApp } from "../src/index";

describe("migration and seed", () => {
  let finance: ReturnType<typeof createFinanceApp>;

  beforeEach(async () => {
    process.env.MOCK_FINANCE_DB_PATH = ":memory:";
    _resetSecret();
    finance = createFinanceApp();
    await finance.seed!();
  });

  afterEach(() => {
    delete process.env.MOCK_FINANCE_DB_PATH;
  });

  it("fresh DB has both migration records", () => {
    const rows = finance.db
      .query<{ id: string }, []>("SELECT id FROM _migrations ORDER BY id")
      .all();
    expect(rows.map((r) => r.id)).toEqual(["finance_v1", "finance_v2"]);
  });

  it("fresh DB has all 15 tables", () => {
    const rows = finance.db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_migrations'"
      )
      .all();
    const expected = [
      "user",
      "department_financial_record",
      "system_config",
      "transaction_record",
      "account_balance",
      "account_transaction",
      "vendor",
      "expense_report",
      "expense_item",
      "invoice",
      "invoice_line_item",
      "asset_record",
      "dashboard_config",
      "portfolio_holding",
      "portfolio_order",
      "budget_alert",
    ];
    for (const t of expected) {
      expect(rows.map((r) => r.name)).toContain(t);
    }
    expect(rows.length).toBe(16);
  });

  it("Phase 1 DB upgrade applies only finance_v2", () => {
    const dbPath = process.env.MOCK_FINANCE_DB_PATH;
    _resetSecret();

    const { Database } = require("bun:sqlite");
    const db = new Database(dbPath, { create: true });
    db.run("PRAGMA foreign_keys = ON");

    const { SCHEMA_SQL } = require("../src/db/schema");
    db.exec(SCHEMA_SQL);
    db.run(`CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    db.run("INSERT INTO _migrations (id) VALUES ('finance_v1')");

    db.run("INSERT INTO user (username, password_hash, role, is_active) VALUES ('legacy', 'legacy_hash', 'user', 1)");

    const { runMigrations } = require("../src/db/migrate");
    runMigrations(db);

    const v2Tables = db
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('dashboard_config', 'portfolio_holding', 'portfolio_order')")
      .all();
    expect(v2Tables.length).toBe(3);

    const migrations = db
      .query<{ id: string }, []>("SELECT id FROM _migrations ORDER BY id")
      .all();
    expect(migrations.map((r) => r.id)).toEqual(["finance_v1", "finance_v2"]);

    const legacy = db
      .query<{ username: string }, []>("SELECT username FROM user WHERE username = 'legacy'")
      .get();
    expect(legacy).toBeDefined();

    db.close();
  });

  it("seedV2 is idempotent", () => {
    const { seedV2 } = require("../src/db/seed-v2");
    seedV2(finance.db);

    const holdings = finance.db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM portfolio_holding")
      .get()!.count;
    expect(holdings).toBe(4);

    const orders = finance.db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM portfolio_order")
      .get()!.count;
    expect(orders).toBe(3);
  });

  it("seedV2 leaves custom-seeded data untouched", () => {
    finance.db.run(
      "UPDATE portfolio_holding SET asset_name = 'Custom', current_value = 999 WHERE asset_class_code = 'eq'"
    );

    const { seedV2 } = require("../src/db/seed-v2");
    seedV2(finance.db);

    const custom = finance.db
      .query<{ asset_name: string; current_value: number }, []>("SELECT asset_name, current_value FROM portfolio_holding WHERE asset_class_code = 'eq'")
      .get();
    expect(custom).toBeDefined();
    expect(custom!.asset_name).toBe("Custom");
    expect(custom!.current_value).toBe(999);
  });
});
