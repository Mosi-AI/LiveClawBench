import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { login, setupFinanceTest } from "./helpers";

describe("dashboard", () => {
  const t = setupFinanceTest();

  beforeEach(async () => {
    await t.init();
  });

  afterEach(() => {
    t.teardown();
  });

  it("GET /api/dashboard returns default KPIs", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/api/dashboard", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.kpis).toBeDefined();
    expect(json.kpis.revenue).toBeGreaterThan(0);
    expect(json.kpis.expense).toBeGreaterThan(0);
    expect(json.monthly.length).toBe(12);
  });

  it("GET /api/dashboard without auth returns 401", async () => {
    const res = await t.app.request("/api/dashboard");
    expect(res.status).toBe(401);
  });

  it("POST /api/dashboard/config by admin succeeds", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/api/dashboard/config", {
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
    const loginRes = await t.app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "john", password: "user123" }),
    });
    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers.get("set-cookie") ?? "";
    const res = await t.app.request("/api/dashboard/config", {
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
    const cookie = await login(t.app);
    const res = await t.app.request("/api/dashboard/config", {
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
    const cookie = await login(t.app);
    const deep = { op: "add", left: { op: "const", value: 1 }, right: { op: "add", left: { op: "const", value: 1 }, right: { op: "add", left: { op: "const", value: 1 }, right: { op: "add", left: { op: "const", value: 1 }, right: { op: "add", left: { op: "const", value: 1 }, right: { op: "const", value: 1 } } } } } };
    const res = await t.app.request("/api/dashboard/config", {
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
    const adminCookie = await login(t.app);
    await t.app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        date_range_start: "2026-01-01",
        date_range_end: "2026-03-31",
        formula_json: "{}",
        department_weight_json: "{}",
      }),
    });

    const johnLogin = await t.app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "john", password: "user123" }),
    });
    const johnCookie = johnLogin.headers.get("set-cookie") ?? "";

    const res = await t.app.request("/api/dashboard", { headers: { Cookie: johnCookie } });
    const json = await res.json();
    expect(json.config.date_range_end).toBe("2026-03-31");
  });

  it("GET /api/dashboard uses defaults when no config exists", async () => {
    const johnLogin = await t.app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "john", password: "user123" }),
    });
    const johnCookie = johnLogin.headers.get("set-cookie") ?? "";

    const res = await t.app.request("/api/dashboard", { headers: { Cookie: johnCookie } });
    const json = await res.json();
    expect(json.config.date_range_start).toBe("2026-01-01");
    expect(json.config.date_range_end).toBe("2026-12-31");
  });

  it("malformed user config falls back to admin config", async () => {
    const adminCookie = await login(t.app);
    await t.app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        date_range_start: "2026-01-01",
        date_range_end: "2026-06-30",
        formula_json: "{}",
        department_weight_json: "{}",
      }),
    });

    const johnLogin = await t.app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "john", password: "user123" }),
    });
    const johnId = (await johnLogin.json()).user.id;
    const johnCookie = johnLogin.headers.get("set-cookie") ?? "";

    t.finance.db.run(
      `INSERT INTO dashboard_config (user_id, date_range_start, date_range_end, formula_json, department_weight_json)
       VALUES (?, '2026-01-01', '2026-12-31', 'not-json', '{}')`,
      [johnId]
    );

    const res = await t.app.request("/api/dashboard", { headers: { Cookie: johnCookie } });
    const json = await res.json();
    expect(json.config.date_range_end).toBe("2026-06-30");
  });

  it("malformed admin config falls back to defaults", async () => {
    const adminId = t.finance.db
      .query<{ id: number }, []>("SELECT id FROM user WHERE role = 'admin' ORDER BY id LIMIT 1")
      .get()!.id;
    t.finance.db.run(
      `UPDATE dashboard_config SET formula_json = 'invalid' WHERE user_id = ?`,
      [adminId]
    );

    const johnLogin = await t.app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "john", password: "user123" }),
    });
    const johnCookie = johnLogin.headers.get("set-cookie") ?? "";

    const res = await t.app.request("/api/dashboard", { headers: { Cookie: johnCookie } });
    const json = await res.json();
    expect(json.config.date_range_start).toBe("2026-01-01");
    expect(json.config.date_range_end).toBe("2026-12-31");
  });

  it("POST /api/dashboard/config unsupported operator returns 400", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        date_range_start: "2026-01-01",
        date_range_end: "2026-12-31",
        formula_json: JSON.stringify({ op: "pow", left: { op: "const", value: 2 }, right: { op: "const", value: 3 } }),
        department_weight_json: "{}",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/dashboard/config unsupported field returns 400", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        date_range_start: "2026-01-01",
        date_range_end: "2026-12-31",
        formula_json: JSON.stringify({ op: "field", name: "invalid_field" }),
        department_weight_json: "{}",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/dashboard/config non-numeric const returns 400", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        date_range_start: "2026-01-01",
        date_range_end: "2026-12-31",
        formula_json: JSON.stringify({ op: "const", value: "not-a-number" }),
        department_weight_json: "{}",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/dashboard/config malformed JSON returns 400", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        date_range_start: "2026-01-01",
        date_range_end: "2026-12-31",
        formula_json: "not-json-at-all",
        department_weight_json: "{}",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("department weights multiply correctly and unspecified default to 1.0", async () => {
    const cookie = await login(t.app);
    await t.app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        date_range_start: "2026-01-01",
        date_range_end: "2026-12-31",
        formula_json: JSON.stringify({ op: "field", name: "revenue_amount" }),
        department_weight_json: JSON.stringify({ Engineering: 2.0 }),
      }),
    });

    const res = await t.app.request("/api/dashboard", { headers: { Cookie: cookie } });
    const json = await res.json();
    expect(json.monthly[0].revenue).toBe(1260000);
  });

  it("date boundaries filter records and empty months show 0", async () => {
    const cookie = await login(t.app);
    await t.app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        date_range_start: "2026-01-01",
        date_range_end: "2026-03-31",
        formula_json: "{}",
        department_weight_json: "{}",
      }),
    });

    const res = await t.app.request("/api/dashboard", { headers: { Cookie: cookie } });
    const json = await res.json();
    expect(json.monthly.length).toBe(3);
    expect(json.monthly[0].month).toBe("2026-01");
    expect(json.monthly[1].month).toBe("2026-02");
    expect(json.monthly[2].month).toBe("2026-03");
    expect(json.monthly[0].revenue).toBeGreaterThan(0);
    expect(json.monthly[1].revenue).toBeGreaterThan(0);
    expect(json.monthly[2].revenue).toBe(0);
  });

  it("POST /api/dashboard/config accepts form-encoded data", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        date_range_start: "2026-01-01",
        date_range_end: "2026-06-30",
        formula_json: "{}",
        department_weight_json: "{}",
      }).toString(),
    });
    expect(res.status).toBe(200);
  });

  it("POST /api/dashboard/config formula_json > 10KB returns 400", async () => {
    const cookie = await login(t.app);
    const bigFormula = JSON.stringify({ op: "const", value: "x".repeat(11000) });
    const res = await t.app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        date_range_start: "2026-01-01",
        date_range_end: "2026-06-30",
        formula_json: bigFormula,
        department_weight_json: "{}",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/dashboard/config department_weight_json > 4KB returns 400", async () => {
    const cookie = await login(t.app);
    const bigWeights = JSON.stringify({ x: "y".repeat(5000) });
    const res = await t.app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        date_range_start: "2026-01-01",
        date_range_end: "2026-06-30",
        formula_json: "{}",
        department_weight_json: bigWeights,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/dashboard/config persists valid config", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        date_range_start: "2026-03-01",
        date_range_end: "2026-05-31",
        formula_json: "{}",
        department_weight_json: JSON.stringify({ Engineering: 1.5 }),
      }),
    });
    expect(res.status).toBe(200);

    const dashboardRes = await t.app.request("/api/dashboard", { headers: { Cookie: cookie } });
    const json = await dashboardRes.json();
    expect(json.config.date_range_start).toBe("2026-03-01");
    expect(json.config.date_range_end).toBe("2026-05-31");
    expect(json.config.department_weight_json).toBe(JSON.stringify({ Engineering: 1.5 }));
  });

  it("POST /api/dashboard/config null weights returns 400", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        date_range_start: "2026-01-01",
        date_range_end: "2026-06-30",
        formula_json: "{}",
        department_weight_json: "null",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/dashboard/config array weights returns 400", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        date_range_start: "2026-01-01",
        date_range_end: "2026-06-30",
        formula_json: "{}",
        department_weight_json: "[]",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/dashboard/config non-numeric weight values returns 400", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/api/dashboard/config", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        date_range_start: "2026-01-01",
        date_range_end: "2026-06-30",
        formula_json: "{}",
        department_weight_json: JSON.stringify({ Engineering: "two" }),
      }),
    });
    expect(res.status).toBe(400);
  });

  it("null department weights in DB falls back to defaults", async () => {
    const adminId = t.finance.db
      .query<{ id: number }, []>("SELECT id FROM user WHERE role = 'admin' ORDER BY id LIMIT 1")
      .get()!.id;
    t.finance.db.run(
      `UPDATE dashboard_config SET department_weight_json = 'null' WHERE user_id = ?`,
      [adminId]
    );

    const johnLogin = await t.app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "john", password: "user123" }),
    });
    const johnCookie = johnLogin.headers.get("set-cookie") ?? "";

    const res = await t.app.request("/api/dashboard", { headers: { Cookie: johnCookie } });
    const json = await res.json();
    expect(json.config.date_range_start).toBe("2026-01-01");
    expect(json.config.date_range_end).toBe("2026-12-31");
  });
});
