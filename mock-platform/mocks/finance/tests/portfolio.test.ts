import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { login, setupFinanceTest } from "./helpers";

describe("portfolio", () => {
  const t = setupFinanceTest();

  beforeEach(async () => {
    await t.init();
  });

  afterEach(() => {
    t.teardown();
  });

  it("GET /api/portfolio returns holdings sorted by asset_class_code and total_value", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/api/portfolio", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.holdings.length).toBe(4);
    expect(json.holdings[0].asset_class_code).toBe("al");
    expect(json.holdings[1].asset_class_code).toBe("ca");
    expect(json.holdings[2].asset_class_code).toBe("eq");
    expect(json.holdings[3].asset_class_code).toBe("fi");
    expect(json.total_value).toBe(250000);
  });

  it("GET /api/portfolio without auth returns 401", async () => {
    const res = await t.app.request("/api/portfolio");
    expect(res.status).toBe(401);
  });

  it("POST /api/portfolio/orders buy increases holding", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/api/portfolio/orders", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ asset_class_code: "eq", direction: "buy", amount: 10000 }),
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.direction).toBe("buy");
    expect(json.status).toBe("executed");

    const holdingsRes = await t.app.request("/api/portfolio", { headers: { Cookie: cookie } });
    const holdingsJson = await holdingsRes.json();
    const eq = holdingsJson.holdings.find((h: any) => h.asset_class_code === "eq");
    expect(eq.current_value).toBe(110000);
  });

  it("POST /api/portfolio/orders sell decreases holding", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/api/portfolio/orders", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ asset_class_code: "eq", direction: "sell", amount: 5000 }),
    });
    expect(res.status).toBe(201);

    const holdingsRes = await t.app.request("/api/portfolio", { headers: { Cookie: cookie } });
    const holdingsJson = await holdingsRes.json();
    const eq = holdingsJson.holdings.find((h: any) => h.asset_class_code === "eq");
    expect(eq.current_value).toBe(95000);
  });

  it("POST /api/portfolio/orders sell exceeding holding returns 400", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/api/portfolio/orders", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ asset_class_code: "eq", direction: "sell", amount: 200000 }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/portfolio/orders invalid asset_class_code returns 400", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/api/portfolio/orders", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ asset_class_code: "xx", direction: "buy", amount: 1000 }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/portfolio/orders non-positive amount returns 400", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/api/portfolio/orders", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ asset_class_code: "eq", direction: "buy", amount: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/portfolio/orders is atomic", async () => {
    const cookie = await login(t.app);
    const before = t.finance.db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM portfolio_order")
      .get()!.count;

    const res = await t.app.request("/api/portfolio/orders", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ asset_class_code: "eq", direction: "sell", amount: 200000 }),
    });
    expect(res.status).toBe(400);

    const after = t.finance.db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM portfolio_order")
      .get()!.count;
    expect(after).toBe(before);
  });

  it("POST /api/portfolio/orders accepts form-encoded data", async () => {
    const cookie = await login(t.app);
    const res = await t.app.request("/api/portfolio/orders", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ asset_class_code: "eq", direction: "buy", amount: "5000" }).toString(),
    });
    expect(res.status).toBe(201);

    const holdingsRes = await t.app.request("/api/portfolio", { headers: { Cookie: cookie } });
    const holdingsJson = await holdingsRes.json();
    const eq = holdingsJson.holdings.find((h: any) => h.asset_class_code === "eq");
    expect(eq.current_value).toBe(105000);
  });

  it("portfolio_holding enforces UNIQUE on asset_class_code", () => {
    expect(() => {
      t.finance.db.run(
        "INSERT INTO portfolio_holding (asset_class_code, asset_name, current_value) VALUES (?, ?, ?)",
        ["eq", "Duplicate", 999]
      );
    }).toThrow();
  });

  it("portfolio_order rejects invalid asset_class_code FK", () => {
    expect(() => {
      t.finance.db.run(
        "INSERT INTO portfolio_order (asset_class_code, direction, amount, status) VALUES (?, ?, ?, ?)",
        ["zz", "buy", 100, "executed"]
      );
    }).toThrow();
  });

  it("transaction rolls back on partial failure", async () => {
    const cookie = await login(t.app);
    const beforeOrders = t.finance.db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM portfolio_order")
      .get()!.count;
    const beforeValue = t.finance.db
      .query<{ current_value: number }, []>("SELECT current_value FROM portfolio_holding WHERE asset_class_code = 'eq'")
      .get()!.current_value;

    const originalRun = t.finance.db.run.bind(t.finance.db);
    let runCalls = 0;
    t.finance.db.run = function (sql: string, ...params: any[]) {
      runCalls++;
      if (runCalls === 2 && typeof sql === "string" && sql.includes("UPDATE portfolio_holding")) {
        throw new Error("Simulated DB failure");
      }
      return originalRun(sql, ...params);
    } as any;

    try {
      const res = await t.app.request("/api/portfolio/orders", {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ asset_class_code: "eq", direction: "buy", amount: 1000 }),
      });
      expect(res.status).toBe(500);
    } finally {
      t.finance.db.run = originalRun;
    }

    const afterOrders = t.finance.db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM portfolio_order")
      .get()!.count;
    const afterValue = t.finance.db
      .query<{ current_value: number }, []>("SELECT current_value FROM portfolio_holding WHERE asset_class_code = 'eq'")
      .get()!.current_value;
    expect(afterOrders).toBe(beforeOrders);
    expect(afterValue).toBe(beforeValue);
  });
});
