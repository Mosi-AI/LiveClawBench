import { z } from "zod";

export const ExpenseItemSchema = z.object({
  expense_category: z.enum(["flight", "hotel", "meals", "transport"]),
  amount: z.number(),
});

export const ExpenseCreateSchema = z.object({
  trip_name: z.string(),
  items: z.array(ExpenseItemSchema),
});

export const ExpenseSubmitResponseSchema = z.object({
  id: z.number(),
  status: z.string(),
});
