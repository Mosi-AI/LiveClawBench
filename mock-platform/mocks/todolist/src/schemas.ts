import { z } from "zod";
import { ErrorResponseSchema } from "mock-lib";

export const TodoSchema = z.object({
  id: z.number(),
  title: z.string(),
  date: z.string(),
  time: z.string().nullable(),
  location: z.string().nullable(),
  person: z.string().nullable(),
  description: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const TodoListResponseSchema = z.array(TodoSchema);

export const TodoSummaryResponseSchema = z.record(z.string(), z.number());

export const TodoDeleteResponseSchema = z.object({
  message: z.string(),
});

export const ListTodosQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export const DateParamSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const MonthParamSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export const IdParamSchema = z.object({
  id: z.string().regex(/^\d+$/),
});

export const CreateTodoBodySchema = z.object({
  title: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  location: z.string().optional().nullable(),
  person: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export const UpdateTodoBodySchema = z.object({
  title: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  location: z.string().optional().nullable(),
  person: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export { ErrorResponseSchema };
