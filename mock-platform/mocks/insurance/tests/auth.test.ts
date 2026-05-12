import { describe, expect, test, beforeEach } from "bun:test";
import { Hono } from "hono";
import { sign, _resetSecret, authRequired } from "mock-lib";

const pageAuth = authRequired({ onUnauthorized: "redirect" });

describe("authRequired redirect middleware", () => {
  beforeEach(() => {
    _resetSecret();
    process.env.NODE_ENV = "test";
    process.env.MOCK_JWT_SECRET = "test-secret-for-deterministic-jwt";
  });

  function createTestApp() {
    const app = new Hono();
    app.get("/protected", pageAuth, (c) => {
      const userId = c.get("userId");
      return c.json({ ok: true, userId });
    });
    return app;
  }

  test("redirects to /login?next=... when no credentials provided", async () => {
    const app = createTestApp();
    const res = await app.request("/protected");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login?next=%2Fprotected");
  });

  test("redirects to /login?next=... when cookie token is invalid", async () => {
    const app = createTestApp();
    const res = await app.request("/protected", {
      headers: { Cookie: "token=invalid-token" },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login?next=%2Fprotected");
  });

  test("allows access with valid cookie token and sets userId", async () => {
    const app = createTestApp();
    const token = await sign({ userId: 42 });
    const res = await app.request("/protected", {
      headers: { Cookie: `token=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.userId).toBe(42);
  });

  test("allows access with valid Bearer token and sets userId", async () => {
    const app = createTestApp();
    const token = await sign({ userId: 99 });
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.userId).toBe(99);
  });

  test("cookie token takes precedence over Bearer when both present", async () => {
    const app = createTestApp();
    const cookieToken = await sign({ userId: 1 });
    const res = await app.request("/protected", {
      headers: {
        Cookie: `token=${cookieToken}`,
        Authorization: "Bearer invalid-bearer-token",
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe(1);
  });
});
