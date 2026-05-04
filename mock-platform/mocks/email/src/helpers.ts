import type { Database } from "bun:sqlite";

export const DEFAULT_USER_ID = 1;

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export function ok<T>(data: T, message?: string): ApiResponse<T> {
  return { success: true, ...(message ? { message } : {}), data };
}

export function err(message: string): { error: string } {
  return { error: message };
}

export function formatDateTime(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19);
}

export function getUserById(db: Database, userId: number) {
  return db
    .query("SELECT id, username, email, created_at FROM users WHERE id = ?")
    .get(userId) as { id: number; username: string; email: string; created_at: string } | null;
}

/**
 * Verify a Werkzeug-generated password hash.
 *
 * Werkzeug format: pbkdf2:sha256:iterations$salt$hash
 * Example: pbkdf2:sha256:600000$abc123$def456...
 *
 * Uses Web Crypto API to replicate hashlib.pbkdf2_hmac('sha256', ...).
 */
export async function verifyWerkzeugHash(hash: string, password: string): Promise<boolean> {
  const parts = hash.split("$");
  if (parts.length !== 3) return false;

  const [methodPart, saltHex, hashB64] = parts;
  const methodMatch = methodPart.match(/^pbkdf2:sha256:(\d+)$/);
  if (!methodMatch) return false;

  const iterations = parseInt(methodMatch[1], 10);
  const salt = new TextEncoder().encode(saltHex);
  const passwordBytes = new TextEncoder().encode(password);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  const derivedHash = btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
  return derivedHash === hashB64;
}

/**
 * Generate a Werkzeug-compatible pbkdf2:sha256 hash (async).
 * Used for seeding the peter user with a known hash format.
 */
export async function generateWerkzeugHash(password: string, iterations = 600000): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(saltBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const passwordBytes = new TextEncoder().encode(password);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(saltHex),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
  return `pbkdf2:sha256:${iterations}$${saltHex}$${hashB64}`;
}

import { pbkdf2Sync } from "node:crypto";

/**
 * Synchronous variant of generateWerkzeugHash for use in seedDatabase.
 */
export function generateWerkzeugHashSync(password: string, iterations = 600000): string {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(saltBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const derived = pbkdf2Sync(password, saltHex, iterations, 32, "sha256");
  const hashB64 = btoa(String.fromCharCode(...derived));
  return `pbkdf2:sha256:${iterations}$${saltHex}$${hashB64}`;
}
