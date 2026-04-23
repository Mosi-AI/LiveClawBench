import { z } from "zod";

/**
 * Standard error response schema used across all mock services.
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
});

/**
 * Validation error response schema injected automatically by the
 * `openApiRoute()` helper when no explicit 400 response is defined.
 */
export const FactoryValidationSchema = z.object({
  error: z.string(),
});
