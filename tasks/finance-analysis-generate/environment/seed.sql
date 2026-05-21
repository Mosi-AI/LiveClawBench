-- Seed for finance-analysis-generate: add March 2026 department data.
-- Runs AFTER default seed, which provides 2026-01 and 2026-02.
-- March data does not conflict (UNIQUE month+department_name).

INSERT OR IGNORE INTO department_financial_record (month, department_name, manager_email, budget_amount, actual_expense_amount, revenue_amount) VALUES
  ('2026-03', 'Engineering', 'eng.manager@example.com', 50000.0, 55000.0, 62000.0),
  ('2026-03', 'Sales', 'sales.manager@example.com', 40000.0, 38000.0, 78000.0),
  ('2026-03', 'Marketing', 'marketing.manager@example.com', 30000.0, 32000.0, 41000.0),
  ('2026-03', 'HR', 'hr.manager@example.com', 20000.0, 19500.0, 5000.0),
  ('2026-03', 'Finance', 'finance.manager@example.com', 25000.0, 23000.0, 8000.0),
  ('2026-03', 'Operations', 'ops.manager@example.com', 35000.0, 34000.0, 12000.0);
