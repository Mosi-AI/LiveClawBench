import { z } from "zod";

/**
 * Standard error response schema used across all mock services.
 *
 * Matches the shape returned by `err()` from mock-lib's response helpers.
 * All error responses — whether from business logic, validation failures,
 * auth middleware, or global error handling — use this same shape.
 */
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
});

/**
 * Validation error response schema injected automatically by the
 * `openApiRoute()` helper when no explicit 400 response is defined.
 *
 * Same shape as ErrorResponseSchema but exported separately for
 * semantic clarity in OpenAPI spec documentation.
 */
export const FactoryValidationSchema = ErrorResponseSchema;
