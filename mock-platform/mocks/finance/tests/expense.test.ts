import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { _resetSecret } from "mock-lib";
import { createFinanceApp } from "../src/index";
import { login } from "./helpers";

describe("expenses", () => {
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

  it("creates report with status=draft and auto-calculated total", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/expense-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        trip_name: "Test Trip",
        items: [
          { expense_category: "flight", amount: 100 },
          { expense_category: "hotel", amount: 200 },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("draft");
    expect(json.total_amount).toBe(300);
  });

  it("submit transitions to submitted", async () => {
    const cookie = await login(app);
    const createRes = await app.request("/api/expense-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        trip_name: "Test Trip",
        items: [{ expense_category: "flight", amount: 100 }],
      }),
    });
    const created = await createRes.json();
    const res = await app.request(`/api/expense-reports/${created.id}/submit`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("submitted");
  });

  it("empty items rejected with 400", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/expense-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ trip_name: "Test", items: [] }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/expense-reports/99999/submit returns 404", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/expense-reports/99999/submit", {
      method: "POST",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Not found");
  });
});
