import type { Database } from "bun:sqlite";
import { formatDateTime } from "mock-lib";

export { formatDateTime };

export const DEFAULT_USER_ID = 1;

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

import { pbkdf2Sync } from "node:crypto";

/**
 * Verify a Werkzeug-generated password hash.
 * Format: pbkdf2:sha256:iterations$salt$hash
 */
export async function verifyWerkzeugHash(hash: string, password: string): Promise<boolean> {
  const parts = hash.split("$");
  if (parts.length !== 3) return false;

  const [methodPart, saltHex, storedHash] = parts;
  const methodMatch = methodPart.match(/^pbkdf2:sha256:(\d+)$/);
  if (!methodMatch) return false;

  const iterations = parseInt(methodMatch[1], 10);
  const salt = new TextEncoder().encode(saltHex);
  const passwordBytes = new TextEncoder().encode(password);

  const keyMaterial = await crypto.subtle.importKey("raw", passwordBytes, { name: "PBKDF2" }, false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  const derivedHash = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return derivedHash === storedHash;
}

/**
 * Synchronous variant for seedDatabase.
 */
export function generateWerkzeugHashSync(password: string, iterations = 600000): string {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(saltBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const derived = pbkdf2Sync(password, saltHex, iterations, 32, "sha256");
  const hashHex = Array.from(derived)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `pbkdf2:sha256:${iterations}$${saltHex}$${hashHex}`;
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
