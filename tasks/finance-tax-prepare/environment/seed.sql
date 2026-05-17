-- Seed for finance-tax-prepare: add March 2026 department data for complete Q1
INSERT OR IGNORE INTO department_financial_record (month, department_name, manager_email, budget_amount, actual_expense_amount, revenue_amount) VALUES
  ('2026-03', 'Engineering', 'eng.manager@example.com', 50000.0, 42000.0, 65000.0),
  ('2026-03', 'Sales', 'sales.manager@example.com', 40000.0, 38000.0, 72000.0),
  ('2026-03', 'Marketing', 'marketing.manager@example.com', 30000.0, 28000.0, 45000.0),
  ('2026-03', 'HR', 'hr.manager@example.com', 20000.0, 18000.0, 5000.0),
  ('2026-03', 'Finance', 'finance.manager@example.com', 25000.0, 22000.0, 10000.0),
  ('2026-03', 'Operations', 'ops.manager@example.com', 35000.0, 33000.0, 15000.0);
