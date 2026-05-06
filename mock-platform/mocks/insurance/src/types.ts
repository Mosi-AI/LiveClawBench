/** Shared types for the insurance mock service. */

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone: string | null;
}

/** User data safe to expose in API responses (no password_hash). */
export type SafeUser = Omit<UserRow, "password_hash">;
