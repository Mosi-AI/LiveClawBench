export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','user')) DEFAULT 'user',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS department_financial_record (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,
  department_name TEXT NOT NULL,
  manager_email TEXT NOT NULL,
  budget_amount REAL NOT NULL DEFAULT 0,
  actual_expense_amount REAL NOT NULL DEFAULT 0,
  revenue_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(month, department_name)
);

CREATE TABLE IF NOT EXISTS system_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transaction_record (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_date TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  category TEXT NOT NULL CHECK(category IN ('travel','office_supplies','software','marketing','utilities','professional_services','meals','transport','other')) DEFAULT 'other',
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','flagged')) DEFAULT 'pending',
  approval_status TEXT NOT NULL CHECK(approval_status IN ('pending','approved','rejected')) DEFAULT 'pending',
  approval_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transaction_trade_date ON transaction_record(trade_date);
CREATE INDEX IF NOT EXISTS idx_transaction_category ON transaction_record(category);
CREATE INDEX IF NOT EXISTS idx_transaction_status ON transaction_record(status);
CREATE INDEX IF NOT EXISTS idx_transaction_vendor_name ON transaction_record(vendor_name);

CREATE TABLE IF NOT EXISTS account_balance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL UNIQUE,
  system_balance REAL NOT NULL DEFAULT 0,
  statement_balance REAL NOT NULL DEFAULT 0,
  diff_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('cleared','pending','flagged')) DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS account_transaction (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_balance_id INTEGER NOT NULL REFERENCES account_balance(id) ON DELETE CASCADE,
  transaction_id INTEGER REFERENCES transaction_record(id) ON DELETE RESTRICT,
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('cleared','pending','flagged')) DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_account_transaction_balance_id ON account_transaction(account_balance_id);
CREATE INDEX IF NOT EXISTS idx_account_transaction_transaction_id ON account_transaction(transaction_id);

CREATE TABLE IF NOT EXISTS vendor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_code TEXT NOT NULL UNIQUE,
  vendor_name TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expense_report (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_name TEXT NOT NULL,
  total_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('draft','submitted','approved','rejected')) DEFAULT 'draft',
  created_by_user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_expense_report_created_by ON expense_report(created_by_user_id);

CREATE TABLE IF NOT EXISTS expense_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_report_id INTEGER NOT NULL REFERENCES expense_report(id) ON DELETE CASCADE,
  expense_category TEXT NOT NULL CHECK(expense_category IN ('flight','hotel','meals','transport')) DEFAULT 'meals',
  amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL REFERENCES vendor(id) ON DELETE RESTRICT,
  vendor_name TEXT,
  invoice_number TEXT NOT NULL,
  invoice_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','submitted','posted','cancelled')) DEFAULT 'submitted',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoice_vendor_id ON invoice(vendor_id);

CREATE TABLE IF NOT EXISTS invoice_line_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category_code TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS asset_record (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_name TEXT NOT NULL,
  cost_basis REAL NOT NULL DEFAULT 0,
  residual_value REAL NOT NULL DEFAULT 0,
  useful_life_years INTEGER NOT NULL DEFAULT 1,
  depreciation_method TEXT NOT NULL CHECK(depreciation_method IN ('straight_line','declining_balance')) DEFAULT 'straight_line',
  annual_depreciation REAL NOT NULL DEFAULT 0,
  correction_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
