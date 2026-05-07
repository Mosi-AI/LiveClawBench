import type { OpenAPIApp } from "mock-lib";
import { _resetSecret } from "mock-lib";
import { createFinanceApp } from "../src/index";

export async function login(app: OpenAPIApp): Promise<string> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });
  return res.headers.get("set-cookie") ?? "";
}

export function setupFinanceTest() {
  let finance: ReturnType<typeof createFinanceApp>;
  let app: ReturnType<typeof createFinanceApp>["app"];

  return {
    get finance() {
      return finance;
    },
    get app() {
      return app;
    },
    async init() {
      process.env.MOCK_FINANCE_DB_PATH = ":memory:";
      _resetSecret();
      finance = createFinanceApp();
      app = finance.app;
      await finance.seed!();
    },
    teardown() {
      delete process.env.MOCK_FINANCE_DB_PATH;
    },
  };
}
