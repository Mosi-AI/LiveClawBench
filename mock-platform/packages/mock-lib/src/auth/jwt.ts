/**
 * JWT authentication module using HS256 with in-memory secret generation.
 *
 * Security properties:
 * - Secret generated at process startup via crypto.getRandomValues() — no env files, no CLI args
 * - Each binary generates its own independent secret (no cross-binary sharing)
 * - API surface supports future evolution to RS256/OAuth2 via sign()/verify() abstraction
 * - ENV override (MOCK_JWT_SECRET) gated behind NODE_ENV=development|test only
 * - Tokens use JWT-compliant base64url encoding (RFC 7519)
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

// --- base64url helpers (RFC 4648 §5) ---

function base64urlEncode(data: Uint8Array | string): string {
  // Encode to UTF-8 first to support Unicode (emojis, non-ASCII characters)
  // btoa() only accepts Latin-1, so we must encode UTF-8 explicitly
  const utf8Bytes = typeof data === "string"
    ? new TextEncoder().encode(data)
    : new Uint8Array(data);
  return btoa(String.fromCharCode(...utf8Bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(b64url: string): Uint8Array {
  // Restore standard base64 padding and characters
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad === 2) b64 += "==";
  else if (pad === 3) b64 += "=";
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// --- Secret management ---

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

/**
 * Check whether the process is running in a development or test environment.
 */
function isDevOrTest(): boolean {
  const env = (process.env.NODE_ENV ?? "").toLowerCase();
  return env === "development" || env === "test";
}

// Secret is generated eagerly at process startup, never lazily.
// This ensures the secret exists before any request handler runs
// and cannot be observed via /proc/PID/cmdline or /proc/PID/environ.
const _startupSecret = generateSecret();

// In-memory secret — resolves once, never changes for the process lifetime.
let _secret: string | null = null;

/**
 * Get the JWT secret for this binary instance.
 *
 * - In production: auto-generated via crypto.getRandomValues() at startup
 * - In dev/test only (NODE_ENV=development|test): can be overridden via MOCK_JWT_SECRET
 */
function getSecret(): string {
  if (_secret === null) {
    // Only accept env override in explicitly dev/test environments
    if (isDevOrTest() && process.env.MOCK_JWT_SECRET) {
      _secret = process.env.MOCK_JWT_SECRET;
    } else {
      _secret = _startupSecret;
    }
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
 * Sign a payload into a JWT string (HS256, base64url encoding).
 */
export async function sign(payload: JwtPayload): Promise<string> {
  const header = { alg: ALGORITHM, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const signedPayload = { ...payload, iat: now, exp: now + TOKEN_EXPIRY_SECONDS };

  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(signedPayload));
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, data);
  const signatureB64 = base64urlEncode(new Uint8Array(signature));

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
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(getSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const signatureBytes = base64urlDecode(signatureB64);
    const sigBuf = new ArrayBuffer(signatureBytes.byteLength);
    new Uint8Array(sigBuf).set(signatureBytes);
    const valid = await crypto.subtle.verify("HMAC", key, sigBuf, data);
    if (!valid) return null;

    const payloadJson = new TextDecoder().decode(base64urlDecode(payloadB64));
    const payload: JwtPayload = JSON.parse(payloadJson);

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
 *
 * Note: secure is set to false in dev/test environments to allow cookies
 * over HTTP (localhost). In production, browsers require HTTPS with secure: true.
 */
export function tokenCookieOptions(): TokenCookieOptions {
  return {
    httpOnly: true,
    secure: !isDevOrTest(),
    sameSite: "Strict",
    maxAge: TOKEN_EXPIRY_SECONDS,
    path: "/",
  };
}

/**
 * Serialize a Set-Cookie header value from a name/value pair and cookie options.
 *
 * Does NOT URL-encode the value — callers must ensure the value contains no
 * characters that conflict with cookie syntax (';', whitespace). Safe for JWTs
 * by construction (base64url alphabet has no reserved cookie characters).
 */
export function serializeCookie(
  name: string,
  value: string,
  opts: TokenCookieOptions,
): string {
  let cookie = `${name}=${value}`;
  if (opts.httpOnly) cookie += "; HttpOnly";
  if (opts.secure) cookie += "; Secure";
  cookie += `; SameSite=${opts.sameSite}`;
  cookie += `; Max-Age=${opts.maxAge}`;
  cookie += `; Path=${opts.path}`;
  return cookie;
}
