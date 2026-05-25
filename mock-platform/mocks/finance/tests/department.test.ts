import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { _resetSecret, resetInjectionState } from "mock-lib";
import { createFinanceApp } from "../src/index";
import { login } from "./helpers";

describe("departments", () => {
  let app: ReturnType<typeof createFinanceApp>["app"];
  let finance: ReturnType<typeof createFinanceApp>;

  beforeEach(async () => {
    process.env.MOCK_FINANCE_DB_PATH = ":memory:";
    _resetSecret();
    resetInjectionState();
    finance = createFinanceApp();
    app = finance.app;
    await finance.seed!();
  });

  afterEach(() => {
    delete process.env.MOCK_FINANCE_DB_PATH;
    delete process.env.TASK_NAME;
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
      "budget_alert",
    ];
    for (const t of expected) {
      expect(tableNames).toContain(t);
    }
    expect(tableNames.length).toBe(16);
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

describe("POST /api/departments/budget-alerts", () => {
  let app: ReturnType<typeof createFinanceApp>["app"];
  let finance: ReturnType<typeof createFinanceApp>;

  beforeEach(async () => {
    process.env.MOCK_FINANCE_DB_PATH = ":memory:";
    _resetSecret();
    resetInjectionState();
    finance = createFinanceApp();
    app = finance.app;
    await finance.seed!();
  });

  afterEach(() => {
    delete process.env.MOCK_FINANCE_DB_PATH;
    delete process.env.TASK_NAME;
  });

  it("returns violation summary for a month", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/departments/budget-alerts", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ month: "2026-01" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.month).toBe("2026-01");
    expect(json.total_departments).toBe(6);
    // Default seed has budget=150K, actual=85K — no violations
    expect(json.violations.length).toBe(0);
  });

  it("returns 400 when month is missing", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/departments/budget-alerts", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.message).toContain("month");
  });

  it("returns 400 for invalid JSON", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/departments/budget-alerts", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.message).toContain("Invalid JSON");
  });

  it("persists budget_alert when department_name and threshold are provided", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/departments/budget-alerts", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ month: "2026-01", department_name: "Marketing", threshold: 0.8 }),
    });
    expect(res.status).toBe(200);

    const row = finance.db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM budget_alert")
      .get();
    expect(row!.count).toBe(1);

    const alert = finance.db
      .query<{ department_name: string; threshold: number; month: string }, []>(
        "SELECT department_name, threshold, month FROM budget_alert LIMIT 1"
      )
      .get();
    expect(alert!.department_name).toBe("Marketing");
    expect(alert!.threshold).toBe(0.8);
    expect(alert!.month).toBe("2026-01");
  });
});

describe("C1 fault injection — finance-budget-shift", () => {
  let app: ReturnType<typeof createFinanceApp>["app"];
  let finance: ReturnType<typeof createFinanceApp>;

  beforeEach(async () => {
    process.env.MOCK_FINANCE_DB_PATH = ":memory:";
    _resetSecret();
    resetInjectionState();
    process.env.TASK_NAME = "finance-budget-shift";
    finance = createFinanceApp();
    app = finance.app;
    await finance.seed!();

    // Insert March 2026 data (same as finance-budget-alert seed.sql)
    const marchData: [string, string, string, number, number, number][] = [
      ["2026-03", "Engineering", "eng.manager@example.com", 150000.0, 180000.0, 200000.0],
      ["2026-03", "Sales", "sales.manager@example.com", 150000.0, -5000.0, 100000.0],
      ["2026-03", "Marketing", "marketing.manager@example.com", 150000.0, 200000.0, 150000.0],
      ["2026-03", "HR", "hr.manager@example.com", 150000.0, 120000.0, 100000.0],
      ["2026-03", "Finance", "finance.manager@example.com", 150000.0, 140000.0, 180000.0],
      ["2026-03", "Operations", "ops.manager@example.com", 150000.0, 130000.0, 140000.0],
    ];
    for (const [month, dept, email, budget, actual, revenue] of marchData) {
      finance.db.run(
        `INSERT OR IGNORE INTO department_financial_record
          (month, department_name, manager_email, budget_amount, actual_expense_amount, revenue_amount)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [month, dept, email, budget, actual, revenue],
      );
    }
  });

  afterEach(() => {
    delete process.env.MOCK_FINANCE_DB_PATH;
    delete process.env.TASK_NAME;
  });

  it("GET /api/departments returns original A2 data before C1 fires", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/departments?month=2026-03", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    // 6 March records
    const marchRecords = json.data.filter((r: any) => r.month === "2026-03");
    expect(marchRecords.length).toBe(6);

    // HR should still have budget 150000 (C1 not yet fired)
    const hr = marchRecords.find((r: any) => r.department_name === "HR");
    expect(hr.budget_amount).toBe(150000.0);
  });

  it("C1 lowers budget on first POST, making non-violating depts over-budget", async () => {
    const cookie = await login(app);

    // Before C1: GET shows HR with budget 150K, actual 120K (no violation)
    const beforeRes = await app.request("/api/departments?month=2026-03", {
      headers: { Cookie: cookie },
    });
    const beforeJson = await beforeRes.json();
    const beforeHr = beforeJson.data.find((r: any) => r.department_name === "HR");
    expect(beforeHr.budget_amount).toBe(150000.0);

    // POST triggers C1: lowers HR/Finance/Operations budget to 100K
    const alertRes = await app.request("/api/departments/budget-alerts", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ month: "2026-03" }),
    });
    expect(alertRes.status).toBe(200);
    const alertJson = await alertRes.json();

    // Now 5 violations: Engineering, Marketing over-budget + HR, Finance, Operations now over-budget after C1
    // Sales was fixed by A2 (negative expense corrected)
    expect(alertJson.violations.length).toBe(5);

    // HR should now be over budget (120K actual > 100K budget)
    const hrViolation = alertJson.violations.find(
      (v: any) => v.department === "HR",
    );
    expect(hrViolation).toBeDefined();
    expect(hrViolation.budget_amount).toBe(100000.0);
    expect(hrViolation.actual_expense_amount).toBe(120000.0);
    expect(hrViolation.violation_type).toBe("over_budget");

    // After C1: GET reflects the changed budget
    const afterRes = await app.request("/api/departments?month=2026-03", {
      headers: { Cookie: cookie },
    });
    const afterJson = await afterRes.json();
    const afterHr = afterJson.data.find((r: any) => r.department_name === "HR");
    expect(afterHr.budget_amount).toBe(100000.0);
  });

  it("C1 is one-shot: second POST does not lower budgets further", async () => {
    const cookie = await login(app);

    // First POST triggers C1
    await app.request("/api/departments/budget-alerts", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ month: "2026-03" }),
    });

    // Verify budgets were lowered
    const hr1 = finance.db
      .query<{ budget_amount: number }, [string, string]>(
        "SELECT budget_amount FROM department_financial_record WHERE month = ? AND department_name = ?",
      )
      .get("2026-03", "HR");
    expect(hr1!.budget_amount).toBe(100000.0);

    // Second POST: budget should NOT change further
    const alert2Res = await app.request("/api/departments/budget-alerts", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ month: "2026-03" }),
    });
    expect(alert2Res.status).toBe(200);

    const hr2 = finance.db
      .query<{ budget_amount: number }, [string, string]>(
        "SELECT budget_amount FROM department_financial_record WHERE month = ? AND department_name = ?",
      )
      .get("2026-03", "HR");
    // Budget stays at 100K, not lowered further
    expect(hr2!.budget_amount).toBe(100000.0);
  });

  it("C1 does not fire for other task names", async () => {
    delete process.env.TASK_NAME;
    process.env.TASK_NAME = "finance-budget-alert";
    const cookie = await login(app);

    const alertRes = await app.request("/api/departments/budget-alerts", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ month: "2026-03" }),
    });
    expect(alertRes.status).toBe(200);
    const alertJson = await alertRes.json();

    // Only 3 violations (A2 only, no C1)
    expect(alertJson.violations.length).toBe(3);
    const deptNames = alertJson.violations.map((v: any) => v.department);
    expect(deptNames).toContain("Engineering");
    expect(deptNames).toContain("Sales");
    expect(deptNames).toContain("Marketing");
    expect(deptNames).not.toContain("HR");

    // HR budget unchanged
    const hr = finance.db
      .query<{ budget_amount: number }, [string, string]>(
        "SELECT budget_amount FROM department_financial_record WHERE month = ? AND department_name = ?",
      )
      .get("2026-03", "HR");
    expect(hr!.budget_amount).toBe(150000.0);
  });
});
