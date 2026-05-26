import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetInjectionState } from "mock-lib";
import { createFinanceApp } from "../src/index";

const MARCH_SEED_SQL = `
INSERT OR IGNORE INTO department_financial_record (month, department_name, manager_email, budget_amount, actual_expense_amount, revenue_amount)
VALUES
  ('2026-03', 'Engineering', 'eng.manager@example.com', 150000.0, 180000.0, 200000.0),
  ('2026-03', 'Sales', 'sales.manager@example.com', 150000.0, -5000.0, 100000.0),
  ('2026-03', 'Marketing', 'marketing.manager@example.com', 150000.0, 200000.0, 150000.0),
  ('2026-03', 'HR', 'hr.manager@example.com', 150000.0, 120000.0, 100000.0),
  ('2026-03', 'Finance', 'finance.manager@example.com', 150000.0, 140000.0, 180000.0),
  ('2026-03', 'Operations', 'ops.manager@example.com', 150000.0, 130000.0, 140000.0);
`;

describe("finance C-axis fault injection", () => {
  let dataDir: string;
  let finance: ReturnType<typeof createFinanceApp>;
  let app: ReturnType<typeof createFinanceApp>["app"];
  let seedPath: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "finance-c-test-"));
    process.env.MOCK_FINANCE_DB_PATH = join(dataDir, "finance.db");
    seedPath = join(dataDir, "seed.sql");
    writeFileSync(seedPath, MARCH_SEED_SQL, "utf-8");
    process.env.MOCK_FINANCE_SEED_SQL = seedPath;
    resetInjectionState();
    delete process.env.TASK_NAME;
  });

  afterEach(() => {
    try { rmSync(dataDir, { recursive: true, force: true }); } catch {}
    delete process.env.MOCK_FINANCE_DB_PATH;
    delete process.env.MOCK_FINANCE_SEED_SQL;
    delete process.env.TASK_NAME;
  });

  async function login(): Promise<string> {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });
    const setCookie = res.headers.get("set-cookie") || "";
    return setCookie;
  }

  // ---------------------------------------------------------------------------
  // C1 — finance-budget-shift
  // ---------------------------------------------------------------------------

  describe("C1: finance-budget-shift", () => {
    beforeEach(async () => {
      process.env.TASK_NAME = "finance-budget-shift";
      finance = createFinanceApp();
      app = finance.app;
      await finance.seed!();
    });

    test("first POST fixes A2 and lowers budget for non-violating departments", async () => {
      const cookie = await login();

      // Before: HR budget is 150K, Sales has negative expense
      const before = finance.db
        .query<{ budget_amount: number; actual_expense_amount: number }, [string, string]>(
          "SELECT budget_amount, actual_expense_amount FROM department_financial_record WHERE month = ? AND department_name = ?",
        )
        .get("2026-03", "HR");
      expect(before!.budget_amount).toBe(150000.0);
      const salesBefore = finance.db
        .query<{ actual_expense_amount: number }, [string, string]>(
          "SELECT actual_expense_amount FROM department_financial_record WHERE month = ? AND department_name = ?",
        )
        .get("2026-03", "Sales");
      expect(salesBefore!.actual_expense_amount).toBe(-5000.0);

      // First POST triggers A2 fix + C1 shift
      const res = await app.request("/api/departments/budget-alerts", {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ month: "2026-03" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      // After C1: HR, Finance, Operations are now over-budget (120K/140K/130K > 100K)
      // Plus Engineering and Marketing still over-budget
      // Sales fixed (5K < 150K)
      expect(json.violations.length).toBe(5);

      // After: HR budget is 100K
      const after = finance.db
        .query<{ budget_amount: number }, [string, string]>(
          "SELECT budget_amount FROM department_financial_record WHERE month = ? AND department_name = ?",
        )
        .get("2026-03", "HR");
      expect(after!.budget_amount).toBe(100000.0);

      // Sales fixed
      const salesAfter = finance.db
        .query<{ actual_expense_amount: number }, [string, string]>(
          "SELECT actual_expense_amount FROM department_financial_record WHERE month = ? AND department_name = ?",
        )
        .get("2026-03", "Sales");
      expect(salesAfter!.actual_expense_amount).toBe(5000.0);
    });

    test("second POST does not lower budgets further (one-shot)", async () => {
      const cookie = await login();

      await app.request("/api/departments/budget-alerts", {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ month: "2026-03" }),
      });

      const after1 = finance.db
        .query<{ budget_amount: number }, [string, string]>(
          "SELECT budget_amount FROM department_financial_record WHERE month = ? AND department_name = ?",
        )
        .get("2026-03", "HR");
      expect(after1!.budget_amount).toBe(100000.0);

      // Second POST
      await app.request("/api/departments/budget-alerts", {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ month: "2026-03" }),
      });

      const after2 = finance.db
        .query<{ budget_amount: number }, [string, string]>(
          "SELECT budget_amount FROM department_financial_record WHERE month = ? AND department_name = ?",
        )
        .get("2026-03", "HR");
      expect(after2!.budget_amount).toBe(100000.0);
    });

    test("budget_alert is persisted when department and threshold provided", async () => {
      const cookie = await login();

      const res = await app.request("/api/departments/budget-alerts", {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ month: "2026-03", department_name: "Marketing", threshold: 120000 }),
      });
      expect(res.status).toBe(200);

      const alert = finance.db
        .query<{ department_name: string; threshold: number }, []>(
          "SELECT department_name, threshold FROM budget_alert LIMIT 1",
        )
        .get();
      expect(alert).toBeDefined();
      expect(alert!.department_name).toBe("Marketing");
      expect(alert!.threshold).toBe(120000);
    });

    test("returns 400 THRESHOLD_EXCEEDED when threshold exceeds lowered budget", async () => {
      const cookie = await login();

      // Try to set alert for HR with threshold > 100000 (lowered by C1)
      const res = await app.request("/api/departments/budget-alerts", {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ month: "2026-03", department_name: "HR", threshold: 150000 }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("THRESHOLD_EXCEEDED");
    });
  });

  // ---------------------------------------------------------------------------
  // Non-C task — no injection
  // ---------------------------------------------------------------------------

  describe("non-C task: no fault injection", () => {
    beforeEach(async () => {
      process.env.TASK_NAME = "finance-budget-alert";
      finance = createFinanceApp();
      app = finance.app;
      await finance.seed!();
    });

    test("POST does not alter budgets for non-C task", async () => {
      const cookie = await login();

      const before = finance.db
        .query<{ budget_amount: number }, [string, string]>(
          "SELECT budget_amount FROM department_financial_record WHERE month = ? AND department_name = ?",
        )
        .get("2026-03", "HR");
      expect(before!.budget_amount).toBe(150000.0);

      const res = await app.request("/api/departments/budget-alerts", {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ month: "2026-03" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.violations.length).toBe(3);

      const after = finance.db
        .query<{ budget_amount: number }, [string, string]>(
          "SELECT budget_amount FROM department_financial_record WHERE month = ? AND department_name = ?",
        )
        .get("2026-03", "HR");
      expect(after!.budget_amount).toBe(150000.0);
    });
  });
});
