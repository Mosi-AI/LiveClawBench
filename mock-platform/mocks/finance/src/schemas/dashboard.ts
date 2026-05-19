import { z } from "zod";

export const DashboardConfigSchema = z.object({
  date_range_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_range_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  formula_json: z.string().max(10240).default("{}"),
  department_weight_json: z.string().max(4096).default("{}"),
});
