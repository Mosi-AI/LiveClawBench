import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { _resetSecret } from "mock-lib";
import { createFinanceApp } from "../src/index";

describe("pages", () => {
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

  it("authenticated GET / has nav buttons in order", async () => {
    const cookie = await login();
    const res = await app.request("/", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const html = await res.text();
    const labels = ["Departments", "Transactions", "Accounts", "Expenses", "Invoices", "Assets"];
    let lastIndex = -1;
    for (const label of labels) {
      const idx = html.indexOf(label);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it("unauthenticated GET / shows login prompt", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Please log in to continue");
    expect(html).toContain("Login");
  });

  it("rendered HTML does not contain [object Object]", async () => {
    const cookie = await login();
    const res = await app.request("/", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).not.toContain("[object Object]");
  });
});
