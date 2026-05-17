import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { login, setupFinanceTest } from "./helpers";

describe("portfolio page", () => {
  const t = setupFinanceTest();

  beforeEach(async () => {
    await t.init();
  });

  afterEach(() => {
    t.teardown();
  });

  it("GET /portfolio renders holdings table and total value", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/portfolio", { headers: { Cookie: cookie } });
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
    const cookie = await login(t.app);
    const res = await t.app.request("/portfolio", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toContain("Place Order");
    expect(html).toContain('action="/portfolio"');
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
    t.finance.db.run("DELETE FROM portfolio_order");
    t.finance.db.run("DELETE FROM portfolio_holding");

    const cookie = await login(t.app);
    const res = await t.app.request("/portfolio", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Portfolio Holdings");
    expect(html).toContain("Total Asset Value");
    expect(html).toContain("0");
  });

  it("GET /portfolio without auth returns 401", async () => {
    const res = await t.app.request("/portfolio");
    expect(res.status).toBe(401);
  });

  it("POST /portfolio with invalid amount shows error", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/portfolio", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ asset_class_code: "eq", direction: "buy", amount: "-100" }).toString(),
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Invalid input");
  });

  it("POST /portfolio with sell exceeding holding shows error", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/portfolio", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ asset_class_code: "eq", direction: "sell", amount: "999999" }).toString(),
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("exceeds holding value");
  });

  it("POST /portfolio with invalid asset class shows error", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/portfolio", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ asset_class_code: "xx", direction: "buy", amount: "1000" }).toString(),
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Invalid input");
  });

  it("POST /portfolio with invalid direction shows error", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/portfolio", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ asset_class_code: "eq", direction: "oops", amount: "1000" }).toString(),
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Invalid input");
  });

  it("POST /portfolio valid buy redirects to portfolio", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/portfolio", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ asset_class_code: "eq", direction: "buy", amount: "5000" }).toString(),
    });
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).toBe("/portfolio");
  });
});
