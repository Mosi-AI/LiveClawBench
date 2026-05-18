import type { Database } from "bun:sqlite";
import type { Context } from "hono";
import type { AppEnv } from "mock-lib";
import { verify, ok, err } from "mock-lib";
import { pbkdf2Sync } from "node:crypto";

export { ok, err };

export function getUserByEmail(db: Database, email: string) {
  return db
    .query("SELECT id, email, display_name, created_at FROM users WHERE email = ?")
    .get(email) as { id: number; email: string; display_name: string; created_at: string } | null;
}

export function getUserById(db: Database, userId: number) {
  return db
    .query("SELECT id, email, display_name, created_at FROM users WHERE id = ?")
    .get(userId) as { id: number; email: string; display_name: string; created_at: string } | null;
}

export async function getAuthUserId(c: Context<AppEnv>): Promise<number | null> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const payload = await verify(token);
    if (payload?.userId) return payload.userId as number;
  } catch {
    // invalid token
  }
  return null;
}

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
  const derivedBits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, 256);
  const derivedHash = Array.from(new Uint8Array(derivedBits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return derivedHash === storedHash;
}

export function generateWerkzeugHashSync(password: string, iterations = 600000): string {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(saltBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const derived = pbkdf2Sync(password, saltHex, iterations, 32, "sha256");
  const hashHex = Array.from(derived).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2:sha256:${iterations}$${saltHex}$${hashHex}`;
}
