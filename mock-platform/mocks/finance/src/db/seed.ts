import type { Database } from "bun:sqlite";
import { readFileSync, existsSync } from "node:fs";
import { round2 } from "../utils";
import { generateWerkzeugHashSync } from "../helpers";

export function seed(db: Database): void {
  const seedPath = process.env.MOCK_FINANCE_SEED_SQL ?? "/opt/mock/data/finance_seed.sql";

  if (existsSync(seedPath)) {
    try {
      const sql = readFileSync(seedPath, "utf-8");
      db.exec(sql);
      return;
    } catch {
      console.warn(`[finance] Seed file not readable at ${seedPath}, falling back to default seed.`);
    }
  } else if (process.env.MOCK_FINANCE_SEED_SQL) {
    console.warn(`[finance] Seed file not found at ${seedPath}, falling back to default seed.`);
  }

  // Default fixtures

  // Users (passwords hashed with Werkzeug-compatible PBKDF2)
  db.run(
    `INSERT OR IGNORE INTO user (username, password_hash, role, is_active) VALUES
      (?, ?, 'admin', 1),
      (?, ?, 'user', 1),
      (?, ?, 'user', 0)`,
    ["admin", generateWerkzeugHashSync("admin123"),
     "john", generateWerkzeugHashSync("user123"),
     "jane", generateWerkzeugHashSync("user123")]
  );

  // Department financial records: 6 depts x 2 months
  const departments = [
    { name: "Engineering", manager: "eng.manager@example.com" },
    { name: "Sales", manager: "sales.manager@example.com" },
    { name: "Marketing", manager: "marketing.manager@example.com" },
    { name: "HR", manager: "hr.manager@example.com" },
    { name: "Finance", manager: "finance.manager@example.com" },
    { name: "Operations", manager: "ops.manager@example.com" },
  ];
  const months = ["2026-01", "2026-02"];
  for (const month of months) {
    for (const dept of departments) {
      db.run(
        `INSERT OR IGNORE INTO department_financial_record
          (month, department_name, manager_email, budget_amount, actual_expense_amount, revenue_amount)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          month,
          dept.name,
          dept.manager,
          150000.0,
          85000.0,
          180000.0,
        ]
      );
    }
  }

  // System config
  db.run(
    `INSERT OR IGNORE INTO system_config (config_key, config_value) VALUES ('approval_limit', '50000')`
  );

  // Transaction records
  if (
    db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM transaction_record")
      .get()!.count === 0
  ) {
    const txnData: [string, string, number, string, string, string][] = [
      ["2026-01-05", "Acme Corp", 12500.5, "software", "pending", "pending"],
      ["2026-01-10", "Globex", 52000.0, "travel", "pending", "pending"],
      ["2026-01-12", "Initech", 3400.0, "office_supplies", "pending", "pending"],
      ["2026-01-15", "Hooli", 78000.0, "marketing", "pending", "pending"],
      ["2026-01-18", "Massive Dynamic", 2100.0, "utilities", "pending", "pending"],
      ["2026-02-01", "Stark Ind", 15000.0, "professional_services", "flagged", "pending"],
      ["2026-02-05", "Wayne Ent", 9000.0, "meals", "pending", "pending"],
      ["2026-02-08", "Cyberdyne", 67000.0, "transport", "pending", "pending"],
      ["2026-02-10", "Umbrella", 4500.0, "software", "pending", "pending"],
      ["2026-02-14", "Oscorp", 32000.0, "travel", "pending", "pending"],
    ];
    for (const [date, vendor, amount, category, status, approvalStatus] of txnData) {
      db.run(
        `INSERT INTO transaction_record
          (trade_date, vendor_name, amount, category, status, approval_status, approval_note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [date, vendor, round2(amount), category, status, approvalStatus, ""]
      );
    }
  }

  // Account balances
  const accountData: [string, number, number, string][] = [
    ["ACC-1001", 50000.0, 49800.0, "pending"],
    ["ACC-1002", 120000.0, 119500.0, "pending"],
    ["ACC-1003", 75000.0, 75200.0, "flagged"],
  ];
  for (const [accId, sysBal, stmtBal, status] of accountData) {
    db.run(
      `INSERT OR IGNORE INTO account_balance (account_id, system_balance, statement_balance, diff_amount, status)
       VALUES (?, ?, ?, ?, ?)`,
      [accId, round2(sysBal), round2(stmtBal), round2(sysBal - stmtBal), status]
    );
  }

  // Account transactions
  const accTxns: [number, number | null, number, string][] = [
    [1, 1, 12500.5, "cleared"],
    [1, 2, 52000.0, "pending"],
    [1, null, 3000.0, "pending"],
    [2, 3, 3400.0, "cleared"],
    [2, 4, 78000.0, "pending"],
    [2, null, 5000.0, "pending"],
    [3, 5, 2100.0, "cleared"],
    [3, 6, 15000.0, "flagged"],
    [3, null, 8000.0, "pending"],
  ];
  if (
    db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM account_transaction")
      .get()!.count === 0
  ) {
    for (const [accBalId, txnId, amount, status] of accTxns) {
      db.run(
        `INSERT INTO account_transaction (account_balance_id, transaction_id, amount, status)
         VALUES (?, ?, ?, ?)`,
        [accBalId, txnId, round2(amount), status]
      );
    }
  }

  // Vendors
  const vendors: [string, string][] = [
    ["V001", "Acme Corp"],
    ["V002", "Globex Systems"],
    ["V003", "Initech Solutions"],
    ["V004", "Hooli Technologies"],
    ["V005", "Stark Industries"],
  ];
  for (const [code, name] of vendors) {
    db.run(
      `INSERT OR IGNORE INTO vendor (vendor_code, vendor_name) VALUES (?, ?)`,
      [code, name]
    );
  }

  // Expense reports
  db.run(
    `INSERT OR IGNORE INTO expense_report (id, trip_name, total_amount, status, created_by_user_id)
     VALUES (1, 'Q1 Sales Trip', 2500.0, 'submitted', 2)`
  );
  db.run(
    `INSERT OR IGNORE INTO expense_report (id, trip_name, total_amount, status, created_by_user_id)
     VALUES (2, 'Dev Conference', 1800.0, 'draft', 2)`
  );

  // Expense items
  if (
    db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM expense_item")
      .get()!.count === 0
  ) {
    db.run(
      `INSERT INTO expense_item (expense_report_id, expense_category, amount) VALUES
        (1, 'flight', 1200.0),
        (1, 'hotel', 800.0),
        (1, 'meals', 500.0),
        (2, 'flight', 1000.0),
        (2, 'hotel', 600.0),
        (2, 'transport', 200.0)`
    );
  }

  // Invoices
  db.run(
    `INSERT OR IGNORE INTO invoice (id, vendor_id, vendor_name, invoice_number, invoice_date, status) VALUES
      (1, 1, 'Acme Corp', 'INV-2026-001', '2026-01-15', 'submitted'),
      (2, 2, 'Globex Systems', 'INV-2026-002', '2026-02-01', 'posted'),
      (3, 3, 'Initech Solutions', 'INV-2026-003', '2026-02-10', 'cancelled')`
  );

  // Invoice line items
  if (
    db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM invoice_line_item")
      .get()!.count === 0
  ) {
    db.run(
      `INSERT INTO invoice_line_item (invoice_id, description, category_code, amount) VALUES
        (1, 'Software License Renewal', '5300', 12500.5),
        (1, 'Support Package', '5400', 3000.0),
        (2, 'Travel Expenses', '5100', 52000.0),
        (3, 'Office Supplies', '5000', 3400.0),
        (3, 'Utilities', '5500', 2100.0)`
    );
  }

  // Asset records
  if (
    db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM asset_record")
      .get()!.count === 0
  ) {
    const assets: [string, number, number, number, string, number][] = [
      ["Server Rack A", 50000.0, 5000.0, 5, "straight_line", 9000.0],
      ["Laptop Fleet", 80000.0, 8000.0, 4, "straight_line", 18000.0],
      ["Office Furniture", 30000.0, 3000.0, 10, "straight_line", 2700.0],
      ["Company Vehicle", 60000.0, 10000.0, 6, "declining_balance", 10000.0],
      ["Network Equipment", 25000.0, 2500.0, 5, "straight_line", 4500.0],
    ];
    for (const [name, cost, residual, life, method, annual] of assets) {
      db.run(
        `INSERT INTO asset_record
          (asset_name, cost_basis, residual_value, useful_life_years, depreciation_method, annual_depreciation)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, round2(cost), round2(residual), life, method, round2(annual)]
      );
    }
  }
}
