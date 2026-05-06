import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { _resetSecret } from "mock-lib";
import { createFinanceApp } from "../src/index";
import { login } from "./helpers";

describe("dashboard page", () => {
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

  it("GET /dashboard renders KPI cards", async () => {
    const cookie = await login(app);
    const res = await app.request("/dashboard", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Revenue");
    expect(html).toContain("Expense");
    expect(html).toContain("Profit");
  });

  it("GET /dashboard renders charts", async () => {
    const cookie = await login(app);
    const res = await app.request("/dashboard", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toContain("Revenue Trend");
    expect(html).toContain("P&amp;L Breakdown");
    expect(html).toContain("<svg");
  });

  it("GET /dashboard renders monthly table", async () => {
    const cookie = await login(app);
    const res = await app.request("/dashboard", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toContain("Monthly Breakdown");
    expect(html).toContain(">Month<");
    expect(html).toContain(">Revenue<");
    expect(html).toContain(">Expense<");
    expect(html).toContain(">Profit<");
  });

  it("GET /dashboard shows Config Panel for admin", async () => {
    const cookie = await login(app);
    const res = await app.request("/dashboard", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toContain("Admin Configuration");
    expect(html).toContain("Formula JSON");
    expect(html).toContain("Department Weights JSON");
    expect(html).toContain('action="/api/dashboard/config"');
  });

  it("GET /dashboard hides Config Panel for non-admin", async () => {
    const loginRes = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "john", password: "user123" }),
    });
    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    const res = await app.request("/dashboard", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).not.toContain("Admin Configuration");
    expect(html).not.toContain('action="/api/dashboard/config"');
  });

  it("GET /dashboard without auth returns 401", async () => {
    const res = await app.request("/dashboard");
    expect(res.status).toBe(401);
  });

  it("dashboard page uses admin config fallback for non-admin", async () => {
    const adminCookie = await login(app);
    await app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        date_range_start: "2026-01-01",
        date_range_end: "2026-03-31",
        formula_json: "{}",
        department_weight_json: "{}",
      }),
    });

    const johnLogin = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "john", password: "user123" }),
    });
    const johnCookie = johnLogin.headers.get("set-cookie") ?? "";

    const res = await app.request("/dashboard", { headers: { Cookie: johnCookie } });
    const html = await res.text();
    // With admin config limiting to 3 months, page should show 3 monthly rows
    const monthMatches = html.match(/2026-01/g);
    expect(monthMatches).not.toBeNull();
    // Should not contain months beyond March
    expect(html).not.toContain("2026-04");
  });
});
