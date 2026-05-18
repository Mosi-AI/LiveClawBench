import { z } from "zod";

export const DepartmentQuerySchema = z.object({
  month: z.string().optional(),
  department: z.string().optional(),
});

export const DepartmentListResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.number(),
      month: z.string(),
      department_name: z.string(),
      manager_email: z.string(),
      budget_amount: z.number(),
      actual_expense_amount: z.number(),
      revenue_amount: z.number(),
    })
  ),
});
