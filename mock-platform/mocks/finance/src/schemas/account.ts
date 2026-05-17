import { z } from "zod";

export const AccountListResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.number(),
      account_id: z.string(),
      system_balance: z.number(),
      statement_balance: z.number(),
      diff_amount: z.number(),
      status: z.string(),
    })
  ),
});

export const AccountTransactionResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.number(),
      account_balance_id: z.number(),
      transaction_id: z.number().nullable(),
      amount: z.number(),
      status: z.string(),
    })
  ),
});
