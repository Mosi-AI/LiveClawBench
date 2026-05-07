import type { Database } from "bun:sqlite";
import { formatDateTime } from "mock-lib";

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export { formatDateTime };

export const DEFAULT_USER_ID = 1;

export function ok<T>(data: T, message?: string): ApiResponse<T> {
  return { success: true, ...(message ? { message } : {}), data };
}

export function err(message: string): ApiResponse<never> {
  return { success: false, message };
}

export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  perPage: number,
  key: string = "items",
): Record<string, unknown> {
  return {
    [key]: items,
    total,
    page,
    per_page: perPage,
    pages: Math.ceil(total / perPage),
  };
}

export function parsePageParams(
  pageStr: string | undefined,
  perPageStr: string | undefined,
): { page: number; perPage: number; offset: number } {
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(perPageStr ?? "20", 10) || 20));
  return { page, perPage, offset: (page - 1) * perPage };
}

export function generateBookingReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let ref = "";
  for (let i = 0; i < 6; i++) {
    ref += chars[Math.floor(Math.random() * chars.length)];
  }
  return ref;
}

export function getUserById(db: Database, userId: number) {
  return db
    .query(
      "SELECT id, email, first_name, last_name, phone, date_of_birth, is_verified, is_active FROM users WHERE id = ?"
    )
    .get(userId) as {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    date_of_birth: string | null;
    is_verified: number;
    is_active: number;
  } | null;
}
