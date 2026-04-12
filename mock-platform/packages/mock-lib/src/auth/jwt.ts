/**
 * JWT authentication module using HS256 with in-memory secret generation.
 *
 * Security properties:
 * - Secret generated at startup via crypto.getRandomValues() — no env files, no CLI args
 * - Each binary generates its own independent secret (no cross-binary sharing)
 * - API surface supports future evolution to RS256/OAuth2 via sign()/verify() abstraction
 * - ENV override (MOCK_JWT_SECRET) for dev/test only, never in production
 */

/**
 * Cookie options for JWT token cookies.
 */
export interface TokenCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
  maxAge: number;
  path: string;
}

const ALGORITHM = "HS256";
const TOKEN_EXPIRY_SECONDS = 3600; // 1 hour

/**
 * Generate a cryptographically random hex string of the specified byte length.
 */
function generateSecret(byteLength: number = 64): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// In-memory secret — generated once per process, never persisted
let _secret: string | null = null;

/**
 * Get the JWT secret for this binary instance.
 *
 * - In production: auto-generated via crypto.getRandomValues()
 * - In dev/test: can be overridden via MOCK_JWT_SECRET environment variable
 */
function getSecret(): string {
  if (_secret === null) {
    // Dev/test override — never use in production
    _secret = process.env.MOCK_JWT_SECRET ?? generateSecret();
  }
  return _secret;
}

/**
 * Reset the in-memory secret (for testing only).
 */
export function _resetSecret(): void {
  _secret = null;
}

export interface JwtPayload {
  [key: string]: unknown;
  userId?: number;
  exp?: number;
}

/**
 * Sign a payload into a JWT string.
 */
export async function sign(payload: JwtPayload): Promise<string> {
  const header = { alg: ALGORITHM, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const signedPayload = { ...payload, iat: now, exp: now + TOKEN_EXPIRY_SECONDS };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify(signedPayload));
  const data = encoder.encode(`${headerB64}.${payloadB64}`);

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, data);
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Verify a JWT string and return the decoded payload.
 * Returns null if the token is invalid, expired, or has a bad signature.
 */
export async function verify(token: string): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const encoder = new TextEncoder();
  const data = encoder.encode(`${headerB64}.${payloadB64}`);

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(getSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const signatureBytes = Uint8Array.from(atob(signatureB64), (c) =>
      c.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, data);
    if (!valid) return null;

    const payload: JwtPayload = JSON.parse(atob(payloadB64));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Get cookie options for JWT tokens.
 */
export function tokenCookieOptions(): TokenCookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    maxAge: TOKEN_EXPIRY_SECONDS,
    path: "/",
  };
}
