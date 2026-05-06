import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { _resetSecret } from "mock-lib";
import { createFinanceApp } from "../src/index";
import { login } from "./helpers";

describe("dashboard", () => {
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

  it("GET /api/dashboard returns default KPIs", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/dashboard", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.kpis).toBeDefined();
    expect(json.kpis.revenue).toBeGreaterThan(0);
    expect(json.kpis.expense).toBeGreaterThan(0);
    expect(json.monthly.length).toBe(12);
  });

  it("GET /api/dashboard without auth returns 401", async () => {
    const res = await app.request("/api/dashboard");
    expect(res.status).toBe(401);
  });

  it("POST /api/dashboard/config by admin succeeds", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        date_range_start: "2026-01-01",
        date_range_end: "2026-06-30",
        formula_json: "{}",
        department_weight_json: "{}",
      }),
    });
    expect(res.status).toBe(200);
  });

  it("POST /api/dashboard/config by non-admin returns 403", async () => {
    const loginRes = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "john", password: "user123" }),
    });
    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers.get("set-cookie") ?? "";
    const res = await app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        date_range_start: "2026-01-01",
        date_range_end: "2026-06-30",
        formula_json: "{}",
        department_weight_json: "{}",
      }),
    });
    expect(res.status).toBe(403);
  });

  it("POST /api/dashboard/config invalid date range returns 400", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        date_range_start: "2026-12-31",
        date_range_end: "2026-01-01",
        formula_json: "{}",
        department_weight_json: "{}",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/dashboard/config formula depth > 5 returns 400", async () => {
    const cookie = await login(app);
    const deep = { op: "add", left: { op: "const", value: 1 }, right: { op: "add", left: { op: "const", value: 1 }, right: { op: "add", left: { op: "const", value: 1 }, right: { op: "add", left: { op: "const", value: 1 }, right: { op: "add", left: { op: "const", value: 1 }, right: { op: "const", value: 1 } } } } } };
    const res = await app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        date_range_start: "2026-01-01",
        date_range_end: "2026-12-31",
        formula_json: JSON.stringify(deep),
        department_weight_json: "{}",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/dashboard uses admin config fallback", async () => {
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

    const res = await app.request("/api/dashboard", { headers: { Cookie: johnCookie } });
    const json = await res.json();
    expect(json.config.date_range_end).toBe("2026-03-31");
  });

  it("GET /api/dashboard uses defaults when no config exists", async () => {
    const johnLogin = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "john", password: "user123" }),
    });
    const johnCookie = johnLogin.headers.get("set-cookie") ?? "";

    const res = await app.request("/api/dashboard", { headers: { Cookie: johnCookie } });
    const json = await res.json();
    expect(json.config.date_range_start).toBe("2026-01-01");
    expect(json.config.date_range_end).toBe("2026-12-31");
  });
});
