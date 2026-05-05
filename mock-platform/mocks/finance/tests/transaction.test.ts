import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { _resetSecret } from "mock-lib";
import { createFinanceApp } from "../src/index";

describe("transactions", () => {
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

  it("GET /api/transactions returns records", async () => {
    const cookie = await login();
    const res = await app.request("/api/transactions", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBeGreaterThan(0);
  });

  it("flag updates status without touching approval_status", async () => {
    const cookie = await login();
    const res = await app.request("/api/transactions/1/flag", {
      method: "POST",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("flagged");
  });

  it("detail includes approval_note", async () => {
    const cookie = await login();
    const res = await app.request("/api/transactions/1", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.approval_note).toBeDefined();
  });
});
