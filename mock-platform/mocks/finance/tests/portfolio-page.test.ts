import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { _resetSecret } from "mock-lib";
import { createFinanceApp } from "../src/index";
import { login } from "./helpers";

describe("portfolio page", () => {
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

  it("GET /portfolio renders holdings table and total value", async () => {
    const cookie = await login(app);
    const res = await app.request("/portfolio", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Portfolio Holdings");
    expect(html).toContain("Total Asset Value");
    expect(html).toContain("EQ");
    expect(html).toContain("FI");
    expect(html).toContain("CA");
    expect(html).toContain("AL");
    expect(html).toContain("250,000");
  });

  it("GET /portfolio renders order form with correct fields", async () => {
    const cookie = await login(app);
    const res = await app.request("/portfolio", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toContain("Place Order");
    expect(html).toContain('action="/api/portfolio/orders"');
    expect(html).toContain('name="asset_class_code"');
    expect(html).toContain('value="eq"');
    expect(html).toContain('value="fi"');
    expect(html).toContain('name="direction"');
    expect(html).toContain('value="buy"');
    expect(html).toContain('value="sell"');
    expect(html).toContain('name="amount"');
    expect(html).toContain('type="number"');
    expect(html).toContain('min="0.01"');
  });

  it("GET /portfolio handles empty holdings", async () => {
    finance.db.run("DELETE FROM portfolio_order");
    finance.db.run("DELETE FROM portfolio_holding");

    const cookie = await login(app);
    const res = await app.request("/portfolio", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Portfolio Holdings");
    expect(html).toContain("Total Asset Value");
    expect(html).toContain("0");
  });

  it("GET /portfolio without auth returns 401", async () => {
    const res = await app.request("/portfolio");
    expect(res.status).toBe(401);
  });
});
