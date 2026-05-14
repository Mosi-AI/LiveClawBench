import { describe, expect, test, beforeEach } from "bun:test";
import { Hono } from "hono";
import { sign, _resetSecret } from "./jwt";
import { authRequired, authOptional } from "./middleware";
import type { AppEnv } from "../types";

beforeEach(() => {
  _resetSecret();
  process.env.NODE_ENV = "test";
  process.env.MOCK_JWT_SECRET = "test-secret-for-deterministic-jwt";
});

function buildApp(
  middleware: ReturnType<typeof authRequired> | typeof authRequired | typeof authOptional,
) {
  const app = new Hono<AppEnv>();
  app.use("/protected/*", middleware as never);
  app.get("/protected/me", (c) => {
    const userId = c.get("userId");
    return c.json({ ok: true, userId: userId ?? null });
  });
  return app;
}

describe("authRequired (direct / default JSON form)", () => {
  test("returns 401 JSON when no credentials provided", async () => {
    const app = buildApp(authRequired);
    const res = await app.request("/protected/me");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("Authentication required");
  });

  test("returns 401 JSON with invalid-token reason when cookie token is malformed", async () => {
    const app = buildApp(authRequired);
    const res = await app.request("/protected/me", {
      headers: { Cookie: "token=not-a-jwt" },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("Invalid or expired token");
  });

  test("allows valid cookie token and exposes userId via c.get", async () => {
    const app = buildApp(authRequired);
    const token = await sign({ userId: 7 });
    const res = await app.request("/protected/me", {
      headers: { Cookie: `token=${token}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, userId: 7 });
  });

  test("allows valid Bearer token when cookie absent", async () => {
    const app = buildApp(authRequired);
    const token = await sign({ userId: 13 });
    const res = await app.request("/protected/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, userId: 13 });
  });

  test("cookie token wins over Authorization header when both present", async () => {
    const app = buildApp(authRequired);
    const cookieToken = await sign({ userId: 1 });
    const res = await app.request("/protected/me", {
      headers: {
        Cookie: `token=${cookieToken}`,
        Authorization: "Bearer this-bearer-is-invalid",
      },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).userId).toBe(1);
  });
});

describe("authRequired (factory form, onUnauthorized = 'redirect')", () => {
  test("redirects to /login?next=<path> by default when no credentials", async () => {
    const app = buildApp(authRequired({ onUnauthorized: "redirect" }));
    const res = await app.request("/protected/me");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login?next=%2Fprotected%2Fme");
  });

  test("redirects when token invalid (same path, regardless of failure reason)", async () => {
    const app = buildApp(authRequired({ onUnauthorized: "redirect" }));
    const res = await app.request("/protected/me", {
      headers: { Cookie: "token=garbage" },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login?next=%2Fprotected%2Fme");
  });

  test("honors custom loginPath option", async () => {
    const app = buildApp(
      authRequired({ onUnauthorized: "redirect", loginPath: "/admin/login" }),
    );
    const res = await app.request("/protected/me");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/admin/login?next=%2Fprotected%2Fme");
  });

  test("allows valid token through (no redirect) and sets userId", async () => {
    const app = buildApp(authRequired({ onUnauthorized: "redirect" }));
    const token = await sign({ userId: 42 });
    const res = await app.request("/protected/me", {
      headers: { Cookie: `token=${token}` },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).userId).toBe(42);
  });
});

describe("authRequired (factory form, onUnauthorized = 'json' explicit)", () => {
  test("returns 401 JSON identical to default direct form", async () => {
    const app = buildApp(authRequired({ onUnauthorized: "json" }));
    const res = await app.request("/protected/me");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("Authentication required");
  });
});

describe("authOptional", () => {
  test("proceeds without userId when no token is present", async () => {
    const app = buildApp(authOptional);
    const res = await app.request("/protected/me");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, userId: null });
  });

  test("proceeds without userId when token is invalid (silent)", async () => {
    const app = buildApp(authOptional);
    const res = await app.request("/protected/me", {
      headers: { Cookie: "token=junk" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, userId: null });
  });

  test("sets userId when token is valid", async () => {
    const app = buildApp(authOptional);
    const token = await sign({ userId: 5 });
    const res = await app.request("/protected/me", {
      headers: { Cookie: `token=${token}` },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).userId).toBe(5);
  });
});
