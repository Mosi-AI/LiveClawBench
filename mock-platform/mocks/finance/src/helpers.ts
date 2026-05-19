import { pbkdf2Sync } from "node:crypto";

/**
 * Verify a Werkzeug-generated password hash.
 *
 * Werkzeug format: pbkdf2:sha256:iterations$salt$hash
 * Uses Web Crypto API to replicate hashlib.pbkdf2_hmac('sha256', ...).
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

  const keyMaterial = await crypto.subtle.importKey("raw", passwordBytes, { name: "PBKDF2" }, false, [
    "deriveBits",
  ]);

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

  const derivedHash = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return derivedHash === storedHash;
}

/**
 * Synchronous variant of generateWerkzeugHash for use in seedDatabase.
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
