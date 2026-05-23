import { createRoute, shouldInject } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { z } from "zod";
import { DepartmentQuerySchema } from "../schemas/department";

export function registerDepartmentRoutes(app: OpenAPIApp, db: Database) {
  const route = createRoute({
    method: "get",
    path: "/api/departments",
    summary: "List departments",
    request: {
      query: DepartmentQuerySchema,
    },
    responses: {
      200: {
        description: "List of department financial records",
      },
    },
  });

  app.openApiRoute(route, (c) => {
    const month = c.req.query("month");
    const department = c.req.query("department");

    let sql = "SELECT * FROM department_financial_record WHERE 1=1";
    const params: (string | number)[] = [];

    if (month) {
      sql += " AND month = ?";
      params.push(month);
    }
    if (department) {
      sql += " AND department_name = ?";
      params.push(department);
    }

    const rows = db.query(sql).all(...params);
    return c.json({ data: rows });
  }, { auth: "required" });

  // POST /api/departments/budget-alerts — create budget alert for a month.
  // Returns violation summary. C1 fault injection for finance-budget-shift.
  const budgetAlertRoute = createRoute({
    method: "post",
    path: "/api/departments/budget-alerts",
    summary: "Create budget alerts for a month",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              month: z.string(),
              department_name: z.string().optional(),
              threshold: z.number().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: "Budget alert created" },
      400: { description: "Bad request or threshold exceeded" },
    },
  });

  app.openApiRoute(budgetAlertRoute, async (c) => {
    let body: { month?: string; department_name?: string; threshold?: number };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    const { month, department_name, threshold } = body;
    if (!month) {
      return c.json({ error: "month is required" }, 400);
    }

    const taskName = process.env.TASK_NAME ?? "";

    // For finance-budget-shift: auto-fix A2 corruption (negative actual_expense)
    // before applying C1 shift, then enforce threshold against post-shift budget.
    if (taskName === "finance-budget-shift") {
      // Fix A2: Sales has negative actual_expense_amount in seed
      db.run(
        `UPDATE department_financial_record
         SET actual_expense_amount = ABS(actual_expense_amount), updated_at = datetime('now')
         WHERE month = '2026-03'
         AND actual_expense_amount < 0`,
      );

      // C1: one-shot lower budget for non-violating departments
      if (
        shouldInject(taskName, "finance", "POST /api/departments/budget-alerts", "c1-budget-shift")
      ) {
        db.run(
          `UPDATE department_financial_record
           SET budget_amount = 100000.0, updated_at = datetime('now')
           WHERE month = '2026-03'
           AND department_name IN ('HR', 'Finance', 'Operations')`,
        );
      }
    }

    // Fetch records after potential mutation
    const rows = db
      .query<{
        department_name: string;
        budget_amount: number;
        actual_expense_amount: number;
        manager_email: string;
      }, [string]>(
        "SELECT department_name, budget_amount, actual_expense_amount, manager_email FROM department_financial_record WHERE month = ?",
      )
      .all(month);

    const violations = rows.filter((r) =>
      r.actual_expense_amount < 0 || r.actual_expense_amount > r.budget_amount,
    );

    // Persist budget alert record when agent explicitly sets up an alert
    if (department_name && threshold !== undefined) {
      // For finance-budget-shift, enforce threshold against the (possibly lowered) budget
      if (taskName === "finance-budget-shift") {
        const deptRow = rows.find((r) => r.department_name === department_name);
        if (deptRow && threshold > deptRow.budget_amount) {
          return c.json(
            {
              error: "THRESHOLD_EXCEEDED",
              message: `Threshold ${threshold} exceeds budget ${deptRow.budget_amount} for ${department_name}`,
              budget_amount: deptRow.budget_amount,
            },
            400,
          );
        }
      }

      db.run(
        `INSERT INTO budget_alert (department_name, threshold, month)
         VALUES (?, ?, ?)`,
        [department_name, threshold, month],
      );
    }

    return c.json({
      month,
      total_departments: rows.length,
      violations: violations.map((v) => ({
        department: v.department_name,
        manager_email: v.manager_email,
        budget_amount: v.budget_amount,
        actual_expense_amount: v.actual_expense_amount,
        violation_type:
          v.actual_expense_amount < 0 ? "negative_expense" : "over_budget",
      })),
    });
  }, { auth: "required" });
}
