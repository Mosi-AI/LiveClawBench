export const SCHEMA_SQL_V2 = `
CREATE TABLE IF NOT EXISTS dashboard_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  date_range_start TEXT NOT NULL,
  date_range_end TEXT NOT NULL,
  formula_json TEXT DEFAULT '{}',
  department_weight_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS portfolio_holding (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_class_code TEXT NOT NULL CHECK(asset_class_code IN ('eq','fi','ca','al')) DEFAULT 'eq',
  asset_name TEXT NOT NULL,
  current_value REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(asset_class_code)
);

CREATE TABLE IF NOT EXISTS portfolio_order (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_class_code TEXT NOT NULL REFERENCES portfolio_holding(asset_class_code) ON DELETE RESTRICT,
  direction TEXT NOT NULL CHECK(direction IN ('buy','sell')) DEFAULT 'buy',
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('submitted','executed','rejected')) DEFAULT 'executed',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
