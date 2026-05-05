import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { _resetSecret } from "mock-lib";
import { createFinanceApp } from "../src/index";

describe("departments", () => {
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
    const cookie = res.headers.get("set-cookie") ?? "";
    return cookie;
  }

  it("GET /api/departments returns 12 records", async () => {
    const cookie = await login();
    const res = await app.request("/api/departments", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBe(12);
  });

  it("filtering by month works", async () => {
    const cookie = await login();
    const res = await app.request("/api/departments?month=2026-01", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBe(6);
  });
});
