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
 *
 * Same shape as ErrorResponseSchema but exported separately for
 * semantic clarity in OpenAPI spec documentation.
 */
export const FactoryValidationSchema = ErrorResponseSchema;
