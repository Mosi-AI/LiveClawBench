import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { _resetSecret } from "mock-lib";
import { createFinanceApp } from "../src/index";

describe("accounts", () => {
  let app: ReturnType<typeof createFinanceApp>["app"];
  let finance: ReturnType<typeof createFinanceApp>;

  beforeEach(async () => {
    process.env.MOCK_FINANCE_DB_PATH = ":memory:";
    _resetSecret();
    finance = createFinanceApp();
    app = finance.app;
    await finance.seed!();
  });

  afterEach(() => {
    delete process.env.MOCK_FINANCE_DB_PATH;
  });

  async function login() {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });
    return res.headers.get("set-cookie") ?? "";
  }

  it("GET /api/accounts returns list", async () => {
    const cookie = await login();
    const res = await app.request("/api/accounts", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBeGreaterThan(0);
  });

  it("detail shows transactions", async () => {
    const cookie = await login();
    const res = await app.request("/api/accounts/1/transactions", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBeGreaterThan(0);
  });

  it("flag updates account status", async () => {
    const cookie = await login();
    const res = await app.request("/api/accounts/1/flag", {
      method: "POST",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("flagged");
  });
});
