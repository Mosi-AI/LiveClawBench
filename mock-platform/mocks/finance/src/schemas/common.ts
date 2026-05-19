import { z } from "zod";

export const ErrorResponseSchema = z.object({
  error: z.string(),
});

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(20),
});

export const IdParamSchema = z.object({
  id: z.coerce.number(),
});
