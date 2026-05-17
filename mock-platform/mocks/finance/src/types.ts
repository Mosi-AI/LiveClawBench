export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface DepartmentFinancialRecord {
  id: number;
  month: string;
  department_name: string;
  manager_email: string;
  budget_amount: number;
  actual_expense_amount: number;
  revenue_amount: number;
  created_at: string;
  updated_at: string;
}

export interface TransactionRecord {
  id: number;
  trade_date: string;
  vendor_name: string;
  amount: number;
  category: string;
  status: string;
  approval_status: string;
  approval_note: string;
  created_at: string;
  updated_at: string;
}

export interface AccountBalance {
  id: number;
  account_id: string;
  system_balance: number;
  statement_balance: number;
  diff_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AccountTransaction {
  id: number;
  account_balance_id: number;
  transaction_id: number | null;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Vendor {
  id: number;
  vendor_code: string;
  vendor_name: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ExpenseReport {
  id: number;
  trip_name: string;
  total_amount: number;
  status: string;
  created_by_user_id: number;
  created_at: string;
  updated_at: string;
}

export interface ExpenseItem {
  id: number;
  expense_report_id: number;
  expense_category: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: number;
  vendor_id: number;
  vendor_name: string | null;
  invoice_number: string;
  invoice_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  id: number;
  invoice_id: number;
  description: string;
  category_code: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface AssetRecord {
  id: number;
  asset_name: string;
  cost_basis: number;
  residual_value: number;
  useful_life_years: number;
  depreciation_method: string;
  annual_depreciation: number;
  correction_reason: string;
  created_at: string;
  updated_at: string;
}

export interface SystemConfig {
  id: number;
  config_key: string;
  config_value: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardConfig {
  id: number;
  user_id: number;
  date_range_start: string;
  date_range_end: string;
  formula_json: string;
  department_weight_json: string;
  created_at: string;
  updated_at: string;
}

export interface PortfolioHolding {
  id: number;
  asset_class_code: string;
  asset_name: string;
  current_value: number;
  created_at: string;
  updated_at: string;
}

export interface PortfolioOrder {
  id: number;
  asset_class_code: string;
  direction: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}
