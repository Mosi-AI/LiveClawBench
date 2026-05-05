import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { _resetSecret } from "mock-lib";
import { createFinanceApp } from "../src/index";
import { login } from "./helpers";

describe("invoices", () => {
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

  it("creates invoice with line items and auto-filled vendor_name", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        vendor_id: 1,
        invoice_number: "INV-TEST-001",
        invoice_date: "2026-03-01",
        items: [
          { description: "Test item", category_code: "5000", amount: 100 },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.vendor_name).toBe("Acme Corp");
  });

  it("invalid category_code returns 400", async () => {
    const cookie = await login(app);
    const res = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        vendor_id: 1,
        invoice_number: "INV-TEST-002",
        invoice_date: "2026-03-01",
        items: [
          { description: "Test", category_code: "9999", amount: 100 },
        ],
      }),
    });
    expect(res.status).toBe(400);
  });
});
