import { describe, expect, test, beforeEach } from "bun:test";
import { createEmailApp } from "../../mocks/email/src/index";
import { resetEmailDb } from "../../mocks/email/src/db";
import { createAirlineApp } from "../../mocks/airline/src/index";
import { resetAirlineDb } from "../../mocks/airline/src/db";
import { createTodolistApp } from "../../mocks/todolist/src/index";
import type { OpenAPIApp } from "mock-lib";

// ---------------------------------------------------------------------------
// Auth envelope contract — mocks that have POST /api/auth/login
// ---------------------------------------------------------------------------

interface AuthMockConfig {
  name: string;
  factory: (opts?: { dbPath?: string }) => { app: OpenAPIApp; seed?: () => void | Promise<void> };
  reset: () => void;
  creds: Record<string, string>;
}

const AUTH_MOCKS: AuthMockConfig[] = [
  {
    name: "email",
    factory: createEmailApp,
    reset: resetEmailDb,
    creds: { username: "peter", password: "password123" },
  },
  {
    name: "airline",
    factory: createAirlineApp,
    reset: resetAirlineDb,
    creds: { email: "peter.griffin@work.mosi.inc", password: "password123" },
  },
];

describe.each(AUTH_MOCKS)("$name: auth envelope contract", ({ factory, reset, creds }) => {
  let app: OpenAPIApp;

  beforeEach(async () => {
    reset();
    const instance = factory({ dbPath: ":memory:" });
    app = instance.app;
    if (instance.seed) {
      await instance.seed();
    }
  });

  test("POST /api/auth/login returns wrapped envelope with data.access_token", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creds),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      success: true,
      data: {
        access_token: expect.any(String),
        user: expect.any(Object),
      },
    });
  });

  test("POST /api/auth/login with wrong password returns { success: false, message }", async () => {
    const wrongCreds = { ...creds, password: "wrong_password_12345" };
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wrongCreds),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({
      success: false,
      message: expect.any(String),
    });
    expect(body).not.toHaveProperty("data");
  });
});

// ---------------------------------------------------------------------------
// Validation-error envelope contract (representative: email mock)
// ---------------------------------------------------------------------------

describe("email: validation error envelope contract", () => {
  let app: OpenAPIApp;

  beforeEach(async () => {
    resetEmailDb();
    const instance = createEmailApp({ dbPath: ":memory:" });
    app = instance.app;
    if (instance.seed) {
      await instance.seed();
    }
  });

  test("invalid query param returns 400 with { success: false, message }", async () => {
    const res = await app.request("/api/emails?folder=invalid_folder");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({
      success: false,
      message: expect.any(String),
    });
  });
});

// ---------------------------------------------------------------------------
// Basic instantiation sanity — mocks that need no external files
// ---------------------------------------------------------------------------

interface SimpleMockConfig {
  name: string;
  factory: () => { app: OpenAPIApp; seed?: () => void | Promise<void> };
}

const SIMPLE_MOCKS: SimpleMockConfig[] = [
  { name: "email", factory: createEmailApp },
  { name: "airline", factory: createAirlineApp },
  { name: "todolist", factory: createTodolistApp },
];

describe.each(SIMPLE_MOCKS)("$name: basic health check", ({ factory }) => {
  let app: OpenAPIApp;

  beforeEach(async () => {
    const instance = factory();
    app = instance.app;
    if (instance.seed) {
      await instance.seed();
    }
  });

  test("GET /health returns 200", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok || body.status).toBeTruthy();
  });
});
