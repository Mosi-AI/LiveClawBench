import type { Database } from "bun:sqlite";
import { round2 } from "../../utils";

export type FormulaNode =
  | { op: "field"; name: "budget_amount" | "actual_expense_amount" | "revenue_amount" }
  | { op: "const"; value: number }
  | { op: "add" | "subtract" | "multiply" | "divide"; left: FormulaNode; right: FormulaNode }
  | { op: "sum"; args: FormulaNode[] };

type BinaryOp = "add" | "subtract" | "multiply" | "divide";

const binaryEvaluators: Record<BinaryOp, (l: number, r: number) => number | null> = {
  add: (l, r) => l + r,
  subtract: (l, r) => l - r,
  multiply: (l, r) => l * r,
  divide: (l, r) => (r === 0 ? null : l / r),
};

export function evalFormula(node: FormulaNode, record: Record<string, number | null>): number | null {
  switch (node.op) {
    case "field":
      return record[node.name] ?? null;
    case "const":
      return node.value;
    case "add":
    case "subtract":
    case "multiply":
    case "divide": {
      const l = evalFormula(node.left, record);
      const r = evalFormula(node.right, record);
      if (l === null || r === null) return null;
      return binaryEvaluators[node.op](l, r);
    }
    case "sum": {
      let total = 0;
      for (const arg of node.args) {
        const v = evalFormula(arg, record);
        if (v !== null) total += v;
      }
      return total;
    }
  }
}

export function formulaDepth(node: FormulaNode): number {
  switch (node.op) {
    case "field":
    case "const":
      return 1;
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
      return 1 + Math.max(formulaDepth(node.left), formulaDepth(node.right));
    case "sum":
      return 1 + (node.args.length > 0 ? Math.max(...node.args.map(formulaDepth)) : 0);
  }
}

export function validateFormulaNode(node: unknown): node is FormulaNode {
  if (typeof node !== "object" || node === null) return false;
  const n = node as Record<string, unknown>;
  if (typeof n.op !== "string") return false;
  switch (n.op) {
    case "field":
      return (
        typeof n.name === "string" &&
        ["budget_amount", "actual_expense_amount", "revenue_amount"].includes(n.name)
      );
    case "const":
      return typeof n.value === "number";
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
      return validateFormulaNode(n.left) && validateFormulaNode(n.right);
    case "sum":
      return Array.isArray(n.args) && n.args.every(validateFormulaNode);
    default:
      return false;
  }
}

export function parseAndValidateFormula(jsonStr: string): { formula: FormulaNode | null; error: string | null } {
  if (!jsonStr || jsonStr === "{}" || jsonStr.trim() === "") {
    return { formula: null, error: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return { formula: null, error: "Invalid JSON" };
  }
  if (!validateFormulaNode(parsed)) {
    return { formula: null, error: "Invalid formula structure" };
  }
  if (formulaDepth(parsed) > 5) {
    return { formula: null, error: "Formula depth exceeds 5" };
  }
  return { formula: parsed, error: null };
}

export interface DashboardMetrics {
  kpis: { revenue: number; expense: number; profit: number };
  monthly: Array<{ month: string; revenue: number; expense: number; profit: number }>;
}

export function computeDashboardMetrics(
  db: Database,
  config: { date_range_start: string; date_range_end: string; formula_json: string; department_weight_json: string }
): DashboardMetrics {
  const rows = db
    .query<{ month: string; department_name: string; budget_amount: number; actual_expense_amount: number; revenue_amount: number }, [string, string]>(
      `SELECT month, department_name, budget_amount, actual_expense_amount, revenue_amount
       FROM department_financial_record
       WHERE month >= substr(?, 1, 7) AND month <= substr(?, 1, 7)
       ORDER BY month, department_name`
    )
    .all(config.date_range_start, config.date_range_end);

  let weights: Record<string, number> = {};
  try {
    weights = JSON.parse(config.department_weight_json || "{}");
  } catch {
    weights = {};
  }

  const customFormula = parseAndValidateFormula(config.formula_json).formula;

  // Monthly aggregation with empty month fill
  const monthlyMap = new Map<string, { revenue: number; expense: number; profit: number }>();

  for (const r of rows) {
    if (!monthlyMap.has(r.month)) {
      monthlyMap.set(r.month, { revenue: 0, expense: 0, profit: 0 });
    }
    const m = monthlyMap.get(r.month)!;
    const w = weights[r.department_name] ?? 1.0;

    if (customFormula) {
      const v = evalFormula(customFormula, r);
      if (v !== null) m.revenue += round2(v * w);
    } else {
      const rev = r.revenue_amount ?? 0;
      const exp = r.actual_expense_amount ?? 0;
      m.revenue += round2(rev * w);
      m.expense += round2(exp * w);
      m.profit += round2((rev - exp) * w);
    }
  }

  // Fill empty months
  const start = new Date(config.date_range_start + "T00:00:00");
  const end = new Date(config.date_range_end + "T00:00:00");
  const allMonths: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    allMonths.push(`${y}-${m}`);
    cur.setMonth(cur.getMonth() + 1);
  }

  const monthly = allMonths.map((month) => ({
    month,
    revenue: monthlyMap.get(month)?.revenue ?? 0,
    expense: monthlyMap.get(month)?.expense ?? 0,
    profit: monthlyMap.get(month)?.profit ?? 0,
  }));

  const revenue = monthly.reduce((s, m) => s + m.revenue, 0);
  const expense = monthly.reduce((s, m) => s + m.expense, 0);
  const profit = monthly.reduce((s, m) => s + m.profit, 0);

  return {
    kpis: { revenue: round2(revenue), expense: round2(expense), profit: round2(profit) },
    monthly,
  };
}
