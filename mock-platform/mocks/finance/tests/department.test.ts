import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { _resetSecret } from "mock-lib";
import { createFinanceApp } from "../src/index";
import { login } from "./helpers";

describe("departments", () => {
  let app: ReturnType<typeof createFinanceApp>["app"];
  let finance: ReturnType<typeof createFinanceApp>;

  beforeEach(async () => {
    process.env.MOCK_FINANCE_DB_PATH = ":memory:";
    _resetSecret();
    finance = createFinanceApp();
    app = finance.app;
    await finance.seed!();
  });

  afterEach(() => {
    delete process.env.MOCK_FINANCE_DB_PATH;
  });

  it("GET /api/departments returns 12 records", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/departments", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBe(12);
  });

  it("filtering by month works", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/departments?month=2026-01", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBe(6);
  });

  it("schema has 12 target tables in sqlite_master", async () => {
    const rows = finance.db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_migrations'"
      )
      .all();
    const tableNames = rows.map((r) => r.name);
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
    ];
    for (const t of expected) {
      expect(tableNames).toContain(t);
    }
    expect(tableNames.length).toBe(15);
  });

  it("user count is 3", async () => {
    const row = finance.db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM user")
      .get();
    expect(row!.count).toBe(3);
  });

  it("department_financial_record count is 12", async () => {
    const row = finance.db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM department_financial_record")
      .get();
    expect(row!.count).toBe(12);
  });
});
