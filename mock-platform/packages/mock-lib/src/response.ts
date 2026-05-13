/**
 * Standard API response envelope for mock services.
 *
 * All new mocks should use `ok()` and `err()` for consistent response shapes.
 * Existing mocks may still use ad-hoc or transitional wrappers.
 */

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export function ok<T>(data: T, message?: string): ApiResponse<T> {
  return { success: true, ...(message ? { message } : {}), data };
}

export function err(message: string): ApiResponse<never> {
  return { success: false, message };
}
