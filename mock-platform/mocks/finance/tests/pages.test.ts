import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { _resetSecret } from "mock-lib";
import { createFinanceApp } from "../src/index";
import { login } from "./helpers";

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

  it("authenticated GET / has nav buttons in order", async () => {
    const cookie = await login(app);
    const res = await app.request("/", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const html = await res.text();
    const labels = ["Departments", "Dashboard", "Transactions", "Accounts", "Expenses", "Invoices", "Assets", "Portfolio"];
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
    const cookie = await login(app);
    const res = await app.request("/", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).not.toContain("[object Object]");
  });
});
