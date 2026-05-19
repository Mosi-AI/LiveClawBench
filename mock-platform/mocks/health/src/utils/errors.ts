import type { Context } from "hono";

type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNSUPPORTED_FREQUENCY"
  | "INTERNAL_ERROR"
  | "FORBIDDEN";

const STATUS_MAP: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNSUPPORTED_FREQUENCY: 400,
  INTERNAL_ERROR: 500,
  FORBIDDEN: 403,
};

export function errorResponse(
  c: Context,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
) {
  const status = STATUS_MAP[code];
  return c.json({ error: code, message, ...(details ? { details } : {}) }, status as any);
}

export class ValidationError extends Error {
  code: ErrorCode = "VALIDATION_ERROR";
  details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.details = details;
  }
}
