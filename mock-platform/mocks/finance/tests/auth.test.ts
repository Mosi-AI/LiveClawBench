import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { _resetSecret } from "mock-lib";
import { createFinanceApp } from "../src/index";

describe("auth", () => {
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

  it("admin login returns 200 with Set-Cookie", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.username).toBe("admin");
    expect(json.user.role).toBe("admin");
    expect(res.headers.get("set-cookie")).toContain("token=");
  });

  it("john login returns 200", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "john", password: "user123" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.username).toBe("john");
  });

  it("jane (inactive) login returns 401", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "jane", password: "user123" }),
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid credentials");
  });

  it("wrong password returns 401", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "wrong" }),
    });
    expect(res.status).toBe(401);
  });

  it("logout clears cookie", async () => {
    const res = await app.request("/api/auth/logout", { method: "POST" });
    expect(res.status).toBe(302);
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("token=");
    expect(cookie).toContain("Max-Age=0");
  });
});
