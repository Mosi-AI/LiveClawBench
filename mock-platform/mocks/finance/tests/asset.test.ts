import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { _resetSecret } from "mock-lib";
import { createFinanceApp } from "../src/index";
import { login } from "./helpers";

describe("assets", () => {
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

  it("edit asset updates fields", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/assets/1", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        cost_basis: 99999,
        residual_value: 9999,
        useful_life_years: 10,
        depreciation_method: "declining_balance",
        annual_depreciation: 9999,
        correction_reason: "Test correction",
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cost_basis).toBe(99999);
    expect(json.depreciation_method).toBe("declining_balance");
  });

  it("empty correction_reason returns 400", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/assets/1", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        cost_basis: 100,
        residual_value: 10,
        useful_life_years: 5,
        depreciation_method: "straight_line",
        annual_depreciation: 18,
        correction_reason: "",
      }),
    });
    expect(res.status).toBe(400);
  });
});
