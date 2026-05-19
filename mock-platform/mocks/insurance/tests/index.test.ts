import { describe, expect, test, beforeEach } from "bun:test";
import { createInsuranceApp } from "../src/index";

describe("insurance mock", () => {
  let insuranceApp: ReturnType<typeof createInsuranceApp>;
  let app: ReturnType<typeof createInsuranceApp>["app"];

  beforeEach(() => {
    process.env.INSURANCE_DB_PATH = ":memory:";
    insuranceApp = createInsuranceApp();
    app = insuranceApp.app;
  });

  test("factory default port is 6000", () => {
    expect(insuranceApp.config.port).toBe(6000);
  });

  test("GET /health returns 200", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("GET /__mock_sentinel__/insurance returns sentinel", async () => {
    const res = await app.request("/__mock_sentinel__/insurance");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
