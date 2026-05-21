-- Corrupted department financial records for March 2026.
-- Runs AFTER default seed, which inserts Jan and Feb records.
-- March data does not conflict (UNIQUE month+department_name).

-- Engineering: over budget (actual 180K > budget 150K)
INSERT OR IGNORE INTO department_financial_record (month, department_name, manager_email, budget_amount, actual_expense_amount, revenue_amount)
VALUES ('2026-03', 'Engineering', 'eng.manager@example.com', 150000.0, 180000.0, 200000.0);

-- Sales: negative actual expense (data integrity issue)
INSERT OR IGNORE INTO department_financial_record (month, department_name, manager_email, budget_amount, actual_expense_amount, revenue_amount)
VALUES ('2026-03', 'Sales', 'sales.manager@example.com', 150000.0, -5000.0, 100000.0);

-- Marketing: over budget (actual 200K > budget 150K)
INSERT OR IGNORE INTO department_financial_record (month, department_name, manager_email, budget_amount, actual_expense_amount, revenue_amount)
VALUES ('2026-03', 'Marketing', 'marketing.manager@example.com', 150000.0, 200000.0, 150000.0);

-- HR: normal (no violation)
INSERT OR IGNORE INTO department_financial_record (month, department_name, manager_email, budget_amount, actual_expense_amount, revenue_amount)
VALUES ('2026-03', 'HR', 'hr.manager@example.com', 150000.0, 120000.0, 100000.0);

-- Finance: normal (no violation)
INSERT OR IGNORE INTO department_financial_record (month, department_name, manager_email, budget_amount, actual_expense_amount, revenue_amount)
VALUES ('2026-03', 'Finance', 'finance.manager@example.com', 150000.0, 140000.0, 180000.0);

-- Operations: normal (no violation)
INSERT OR IGNORE INTO department_financial_record (month, department_name, manager_email, budget_amount, actual_expense_amount, revenue_amount)
VALUES ('2026-03', 'Operations', 'ops.manager@example.com', 150000.0, 130000.0, 140000.0);
