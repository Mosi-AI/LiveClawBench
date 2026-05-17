import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { _resetSecret } from "mock-lib";
import { createFinanceApp } from "../src/index";

describe("jwt expiry", () => {
  let app: ReturnType<typeof createFinanceApp>["app"];
  let finance: ReturnType<typeof createFinanceApp>;

  beforeEach(async () => {
    process.env.MOCK_FINANCE_DB_PATH = ":memory:";
    _resetSecret();
  });

  afterEach(() => {
    delete process.env.MOCK_FINANCE_DB_PATH;
    delete process.env.MOCK_TOKEN_EXPIRY_SECONDS;
  });

  async function getToken(): Promise<string> {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });
    const cookie = res.headers.get("set-cookie") ?? "";
    const match = cookie.match(/token=([^;]+)/);
    return match ? match[1] : "";
  }

  function decodePayload(token: string): Record<string, unknown> {
    const parts = token.split(".");
    expect(parts.length).toBe(3);
    const payloadB64 = parts[1];
    // base64url -> base64
    let b64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad === 2) b64 += "==";
    else if (pad === 3) b64 += "=";
    const json = atob(b64);
    return JSON.parse(json);
  }

  it("MOCK_TOKEN_EXPIRY_SECONDS=28800 affects JWT exp and cookie Max-Age", async () => {
    process.env.MOCK_TOKEN_EXPIRY_SECONDS = "28800";
    finance = createFinanceApp();
    app = finance.app;
    await finance.seed!();

    const token = await getToken();
    const payload = decodePayload(token);
    expect(payload.exp).toBeDefined();
    const iat = payload.iat as number;
    const exp = payload.exp as number;
    expect(exp - iat).toBe(28800);

    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });
    expect(res.headers.get("set-cookie")).toContain("Max-Age=28800");
  });

  it("invalid MOCK_TOKEN_EXPIRY_SECONDS falls back to 3600 in JWT and cookie", async () => {
    process.env.MOCK_TOKEN_EXPIRY_SECONDS = "invalid";
    finance = createFinanceApp();
    app = finance.app;
    await finance.seed!();

    const token = await getToken();
    const payload = decodePayload(token);
    expect(payload.exp).toBeDefined();
    const iat = payload.iat as number;
    const exp = payload.exp as number;
    expect(exp - iat).toBe(3600);

    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });
    expect(res.headers.get("set-cookie")).toContain("Max-Age=3600");
  });

  it("unset MOCK_TOKEN_EXPIRY_SECONDS falls back to 3600 in JWT and cookie", async () => {
    delete process.env.MOCK_TOKEN_EXPIRY_SECONDS;
    // createFinanceApp() sets MOCK_TOKEN_EXPIRY_SECONDS ??= "28800".
    // Override it back to empty so the fallback path is exercised.
    const original = process.env.MOCK_TOKEN_EXPIRY_SECONDS;
    process.env.MOCK_TOKEN_EXPIRY_SECONDS = "";
    finance = createFinanceApp();
    app = finance.app;
    await finance.seed!();

    const token = await getToken();
    const payload = decodePayload(token);
    expect(payload.exp).toBeDefined();
    const iat = payload.iat as number;
    const exp = payload.exp as number;
    expect(exp - iat).toBe(3600);

    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });
    expect(res.headers.get("set-cookie")).toContain("Max-Age=3600");
  });
});
