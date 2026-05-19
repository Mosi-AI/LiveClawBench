import { z } from "zod";

export const TransactionQuerySchema = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
  vendor: z.string().optional(),
});

export const TransactionFlagResponseSchema = z.object({
  id: z.number(),
  status: z.string(),
});
