import { describe, expect, test, beforeEach } from "bun:test";
import { _resetSecret, resetDb } from "mock-lib";
import { createInsuranceApp } from "../src/index";
import {
  DEFAULT_USER_EMAIL,
  DEFAULT_USER_PASSWORD,
} from "../src/seed";

describe("auth routes", () => {
  beforeEach(() => {
    resetDb();
    _resetSecret();
    process.env.NODE_ENV = "test";
    process.env.MOCK_JWT_SECRET = "test-secret-for-deterministic-jwt";
    process.env.INSURANCE_DB_PATH = ":memory:";
  });

  function createApp() {
    const insuranceApp = createInsuranceApp();
    insuranceApp.seed!();
    return insuranceApp.app;
  }

  test("POST /api/auth/login with correct credentials returns 200 + token + cookie", async () => {
    const app = createApp();
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: DEFAULT_USER_EMAIL,
        password: DEFAULT_USER_PASSWORD,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(body.token.length).toBeGreaterThan(0);
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(DEFAULT_USER_EMAIL);

    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain("token=");
    expect(setCookie).toContain("HttpOnly");
  });

  test("POST /api/auth/login with wrong password returns 401 JSON", async () => {
    const app = createApp();
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: DEFAULT_USER_EMAIL,
        password: "wrong-password",
      }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("Invalid email or password");
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  test("POST /api/auth/register creates a new user and returns 201 + token", async () => {
    const app = createApp();
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "new.user@example.com",
        password: "newpassword",
        first_name: "New",
        last_name: "User",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe("new.user@example.com");

    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain("token=");
  });

  test("POST /api/auth/register with duplicate email returns 400", async () => {
    const app = createApp();
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: DEFAULT_USER_EMAIL,
        password: "password",
        first_name: "Dup",
        last_name: "User",
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("Email already registered");
  });

  test("GET /api/auth/me with valid Bearer token returns user", async () => {
    const app = createApp();
    const loginRes = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: DEFAULT_USER_EMAIL,
        password: DEFAULT_USER_PASSWORD,
      }),
    });
    const { token } = await loginRes.json();

    const meRes = await app.request("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.email).toBe(DEFAULT_USER_EMAIL);
  });

  test("GET /api/auth/me with valid cookie token returns user", async () => {
    const app = createApp();
    const loginRes = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: DEFAULT_USER_EMAIL,
        password: DEFAULT_USER_PASSWORD,
      }),
    });
    const setCookie = loginRes.headers.get("Set-Cookie")!;
    const cookieValue = setCookie.split(";")[0]; // token=...

    const meRes = await app.request("/api/auth/me", {
      headers: { Cookie: cookieValue },
    });
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.email).toBe(DEFAULT_USER_EMAIL);
  });

  test("GET /api/auth/me without token returns 401", async () => {
    const app = createApp();
    const res = await app.request("/api/auth/me");
    expect(res.status).toBe(401);
  });

  test("POST /login SSR with correct credentials sets cookie and redirects to /claims", async () => {
    const app = createApp();
    const body = new URLSearchParams({
      email: DEFAULT_USER_EMAIL,
      password: DEFAULT_USER_PASSWORD,
      next: "/claims",
    });
    const res = await app.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/claims");
    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain("token=");
  });

  test("POST /login SSR with wrong password returns 200 with error HTML", async () => {
    const app = createApp();
    const body = new URLSearchParams({
      email: DEFAULT_USER_EMAIL,
      password: "wrong-password",
      next: "/claims",
    });
    const res = await app.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Invalid email or password");
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  test("POST /login SSR respects next parameter", async () => {
    const app = createApp();
    const body = new URLSearchParams({
      email: DEFAULT_USER_EMAIL,
      password: DEFAULT_USER_PASSWORD,
      next: "/plans",
    });
    const res = await app.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/plans");
  });
});
