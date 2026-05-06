import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { _resetSecret } from "mock-lib";
import { createFinanceApp } from "../src/index";
import { login } from "./helpers";

describe("portfolio", () => {
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

  it("GET /api/portfolio returns holdings sorted by asset_class_code and total_value", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/portfolio", { headers: { Cookie: cookie } });
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
    const res = await app.request("/api/portfolio");
    expect(res.status).toBe(401);
  });

  it("POST /api/portfolio/orders buy increases holding", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/portfolio/orders", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ asset_class_code: "eq", direction: "buy", amount: 10000 }),
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.direction).toBe("buy");
    expect(json.status).toBe("executed");

    const holdingsRes = await app.request("/api/portfolio", { headers: { Cookie: cookie } });
    const holdingsJson = await holdingsRes.json();
    const eq = holdingsJson.holdings.find((h: any) => h.asset_class_code === "eq");
    expect(eq.current_value).toBe(110000);
  });

  it("POST /api/portfolio/orders sell decreases holding", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/portfolio/orders", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ asset_class_code: "eq", direction: "sell", amount: 5000 }),
    });
    expect(res.status).toBe(201);

    const holdingsRes = await app.request("/api/portfolio", { headers: { Cookie: cookie } });
    const holdingsJson = await holdingsRes.json();
    const eq = holdingsJson.holdings.find((h: any) => h.asset_class_code === "eq");
    expect(eq.current_value).toBe(95000);
  });

  it("POST /api/portfolio/orders sell exceeding holding returns 400", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/portfolio/orders", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ asset_class_code: "eq", direction: "sell", amount: 200000 }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/portfolio/orders invalid asset_class_code returns 400", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/portfolio/orders", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ asset_class_code: "xx", direction: "buy", amount: 1000 }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/portfolio/orders non-positive amount returns 400", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/portfolio/orders", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ asset_class_code: "eq", direction: "buy", amount: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/portfolio/orders is atomic", async () => {
    const cookie = await login(app);
    const before = finance.db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM portfolio_order")
      .get()!.count;

    const res = await app.request("/api/portfolio/orders", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ asset_class_code: "eq", direction: "sell", amount: 200000 }),
    });
    expect(res.status).toBe(400);

    const after = finance.db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM portfolio_order")
      .get()!.count;
    expect(after).toBe(before);
  });
});
