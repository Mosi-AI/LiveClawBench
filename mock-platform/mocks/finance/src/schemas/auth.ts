import { z } from "zod";

export const LoginRequestSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const LoginResponseSchema = z.object({
  user: z.object({
    id: z.number(),
    username: z.string(),
    role: z.string(),
  }),
});
