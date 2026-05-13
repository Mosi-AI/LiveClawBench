import { describe, expect, test, beforeAll } from "bun:test";
import { z } from "zod";
import { createMockApp, createRoute } from "../index";
import type { MockAppV2, OpenAPIApp } from "../index";
import { sign, _resetSecret } from "../auth/jwt";

/** Helper: create a test app with common defaults. */
function createTestApp(options?: {
  openApi?: boolean;
  dev?: boolean;
  name?: string;
  healthResponse?: Record<string, unknown>;
}): OpenAPIApp {
  const mockApp = createMockApp({
    name: options?.name ?? "test",
    dev: options?.dev,
    openApi: options?.openApi !== false ? { enabled: true } : undefined,
    healthResponse: options?.healthResponse,
  });
  return mockApp.app as OpenAPIApp;
}

/** Helper: generate OpenAPI 3.1 spec from an app with standard test metadata. */
function getSpec(app: OpenAPIApp) {
  return app.getOpenAPI31Document({
    openapi: "3.1.0",
    info: { title: "test", version: "1.0.0" },
  });
}

describe("createMockApp — factory basics", () => {
  test("returns { config, app } with app extending OpenAPIHono", () => {
    const mockApp = createMockApp({ name: "test" });
    expect(mockApp).toHaveProperty("config");
    expect(mockApp).toHaveProperty("app");
    expect(typeof mockApp.app.get).toBe("function");
    expect(typeof (mockApp.app as OpenAPIApp).page).toBe("function");
    expect(typeof (mockApp.app as OpenAPIApp).openApiRoute).toBe("function");
  });

  test("openApiRoute registers routes in OpenAPI spec", () => {
    const app = createTestApp();

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/items",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: z.object({ count: z.number() }),
              },
            },
          },
        },
      }),
      (c) => c.json({ count: 0 }),
    );

    const spec = getSpec(app);
    expect(spec.paths).toHaveProperty("/api/items");
    expect(spec.paths!["/api/items"]).toHaveProperty("get");
  });
});

describe("page() — exclusion from OpenAPI spec", () => {
  test("page routes do NOT appear in spec.paths", () => {
    const app = createTestApp();

    app.page("/", (c) => c.html("<h1>Home</h1>") as any);
    app.page("/about", (c) => c.html("<h1>About</h1>") as any);

    const spec = getSpec(app);
    expect(spec.paths).not.toHaveProperty("/");
    expect(spec.paths).not.toHaveProperty("/about");
  });
});

describe("auth security field", () => {
  test("auth: required generates security: [{ bearerAuth: [] }]", () => {
    const app = createTestApp();

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/protected",
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ ok: true }),
      { auth: "required" },
    );

    const spec = getSpec(app);
    const route = spec.paths!["/api/protected"].get!;
    expect(route.security).toEqual([{ bearerAuth: [] }]);
  });

  test("auth: required auto-injects 401 response in spec", () => {
    const app = createTestApp();

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/protected-401",
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ ok: true }),
      { auth: "required" },
    );

    const spec = getSpec(app);
    const responses = spec.paths!["/api/protected-401"].get!.responses!;
    expect(responses).toHaveProperty("401");
    expect(responses["401"].description).toBe("Unauthorized");
  });

  test("auth: required preserves explicit 401 response", () => {
    const app = createTestApp();

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/protected-explicit-401",
        responses: {
          200: { description: "OK" },
          401: {
            description: "Custom unauthorized",
            content: {
              "application/json": {
                schema: z.object({ custom: z.string() }),
              },
            },
          },
        },
      }),
      (c) => c.json({ ok: true }),
      { auth: "required" },
    );

    const spec = getSpec(app);
    const responses = spec.paths!["/api/protected-explicit-401"].get!.responses!;
    expect(responses).toHaveProperty("401");
    expect(responses["401"].description).toBe("Custom unauthorized");
  });

  test("components.securitySchemes.bearerAuth exists when openApi.enabled", () => {
    const app = createTestApp();

    const spec = getSpec(app);
    expect(spec.components?.securitySchemes).toHaveProperty("bearerAuth");
    expect((spec.components?.securitySchemes as any)?.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
  });

  test("auth: optional (default) does NOT generate security field", () => {
    const app = createTestApp();

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/public",
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ ok: true }),
    );

    const spec = getSpec(app);
    const route = spec.paths!["/api/public"].get!;
    expect(route.security).toBeUndefined();
  });

  test("auth: required returns 401 when no Authorization header", async () => {
    const app = createTestApp();

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/protected-runtime",
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ secret: "data" }),
      { auth: "required" },
    );

    const res = await app.request("/api/protected-runtime");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ success: false, message: "Authentication required" });
  });

  test("auth: required returns 401 when Authorization has no Bearer prefix", async () => {
    const app = createTestApp();

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/protected-bad-scheme",
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ secret: "data" }),
      { auth: "required" },
    );

    const res = await app.request("/api/protected-bad-scheme", {
      headers: { Authorization: "Basic abc123" },
    });
    expect(res.status).toBe(401);
  });

  test("auth: required returns 401 when Bearer token is empty", async () => {
    const app = createTestApp();

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/protected-empty-token",
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ secret: "data" }),
      { auth: "required" },
    );

    const res = await app.request("/api/protected-empty-token", {
      headers: { Authorization: "Bearer " },
    });
    expect(res.status).toBe(401);
  });

  test("auth: required passes through with valid JWT token", async () => {
    const app = createTestApp();

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/protected-valid",
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ secret: "data" }),
      { auth: "required" },
    );

    const token = await sign({ userId: 42 });
    const res = await app.request("/api/protected-valid", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ secret: "data" });
  });

  test("auth: required rejects invalid JWT token", async () => {
    const app = createTestApp();

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/protected-invalid-jwt",
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ secret: "data" }),
      { auth: "required" },
    );

    const res = await app.request("/api/protected-invalid-jwt", {
      headers: { Authorization: "Bearer not-a-real-jwt" },
    });
    expect(res.status).toBe(401);
  });

  test("auth: required works with OpenAPI path templates ({param} syntax)", async () => {
    const app = createTestApp();

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/items/{id}",
        request: {
          params: z.object({ id: z.string() }),
        },
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ itemId: c.req.valid("param").id }),
      { auth: "required" },
    );

    // No auth header → 401 (handler wrapping rejects for parameterized routes)
    const res = await app.request("/api/items/abc");
    expect(res.status).toBe(401);

    // Valid JWT → 200 (middleware passes, handler runs)
    const token = await sign({ userId: 1 });
    const res2 = await app.request("/api/items/abc", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res2.status).toBe(200);
    const body = await res2.json();
    expect(body).toEqual({ itemId: "abc" });
  });

  test("auth: required rejects before Zod validation (401 not 400)", async () => {
    const app = createTestApp();

    app.openApiRoute(
      createRoute({
        method: "post",
        path: "/api/protected-zod",
        request: {
          body: {
            content: {
              "application/json": {
                schema: z.object({ name: z.string().min(1) }),
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ ok: true }),
      { auth: "required" },
    );

    // No auth header + invalid body → should be 401 (not 400)
    const res = await app.request("/api/protected-zod", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: 123 }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ success: false, message: "Authentication required" });
  });

  test("auth middleware on parameterized route does not block sibling static routes", async () => {
    const app = createTestApp();

    // Register the STATIC sibling first so Hono routes to it.
    // (Hono uses first-match-wins for static vs parameterized on the same prefix.)
    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/items/special",
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ special: true }),
    );

    // Register a parameterized route with auth (handler wrapping, no hono.use)
    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/items/{id}",
        request: {
          params: z.object({ id: z.string() }),
        },
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ itemId: c.req.valid("param").id }),
      { auth: "required" },
    );

    // Static sibling should NOT be blocked — no hono.use() overmatching
    const res = await app.request("/api/items/special");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ special: true });

    // Parameterized route should still require auth
    const resNoAuth = await app.request("/api/items/abc");
    expect(resNoAuth.status).toBe(401);

    const token = await sign({ userId: 1 });
    const resAuth = await app.request("/api/items/abc", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resAuth.status).toBe(200);
    expect(await resAuth.json()).toEqual({ itemId: "abc" });
  });
});

describe("/openapi.json endpoint gating", () => {
  test("/openapi.json is available in dev mode", async () => {
    const app = createTestApp({ dev: true });

    const res = await app.request("/openapi.json");
    expect(res.status).toBe(200);
    const spec = await res.json();
    expect(spec.openapi).toBe("3.1.0");
  });

  test("/openapi.json is NOT available without dev mode", async () => {
    const app = createTestApp();

    const res = await app.request("/openapi.json");
    expect(res.status).toBe(404);
  });

  test("spec generation still works without dev mode", () => {
    const app = createTestApp();

    // getOpenAPI31Document() should still work for build-time generation
    const spec = getSpec(app);
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("test");
  });

  test("startServer({ dev: true }) flips /openapi.json from 404 to 200", async () => {
    const { startServer } = await import("../index");

    // Construction-time view: dev=false, so /openapi.json should be 404 here.
    // Verified separately by the test above ("/openapi.json is NOT available
    // without dev mode"); we can't `app.request()` before startServer because
    // Hono builds its router matcher on first request, which prevents
    // startServer's logger middleware registration from succeeding.

    const mockApp = createMockApp({
      name: "test",
      openApi: { enabled: true },
    });

    // Monkey-patch Bun.serve so startServer doesn't open a real socket
    const originalServe = Bun.serve;
    Bun.serve = (() => ({ stop: () => {} } as any)) as any;
    try {
      await startServer(mockApp, { dev: true });
    } finally {
      Bun.serve = originalServe;
    }

    // After startServer with dev override: closure now sees dev=true → 200
    const after = await mockApp.app.request("/openapi.json");
    expect(after.status).toBe(200);
    const spec = await after.json();
    expect(spec.openapi).toBe("3.1.0");
    // Sanity check: the override propagated to mockApp.config.dev
    expect(mockApp.config.dev).toBe(true);
  });

  test("startServer without dev override leaves /openapi.json at 404", async () => {
    const { startServer } = await import("../index");
    const mockApp = createMockApp({
      name: "test",
      openApi: { enabled: true },
    });

    const originalServe = Bun.serve;
    Bun.serve = (() => ({ stop: () => {} } as any)) as any;
    try {
      await startServer(mockApp);
    } finally {
      Bun.serve = originalServe;
    }

    const res = await mockApp.app.request("/openapi.json");
    expect(res.status).toBe(404);
    expect(mockApp.config.dev).toBe(false);
  });
});

describe("/health endpoint", () => {
  test("/health appears in generated OpenAPI spec with 200 response", () => {
    const app = createTestApp();

    const spec = getSpec(app);
    expect(spec.paths).toBeDefined();
    expect(spec.paths!["/health"]).toBeDefined();
    expect(spec.paths!["/health"].get).toBeDefined();
    expect(spec.paths!["/health"].get!.responses!["200"]).toBeDefined();
    expect(spec.paths!["/health"].get!.responses!["200"].description).toBe(
      "Service is healthy",
    );
  });

  test("GET /health returns default shape when no healthResponse provided", async () => {
    const mockApp = createMockApp({ name: "test-svc" });
    const res = await mockApp.app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      status: "healthy",
      service: "test-svc",
    });
  });

  test("GET /health returns custom healthResponse without ok field (shop parity)", async () => {
    // Mirrors mocks/shop usage: healthResponse omits `ok` and only includes
    // status + service. The route must serve this shape unchanged because
    // Zod-OpenAPI does not validate response bodies, and the registered schema
    // uses `.passthrough()` to document arbitrary additional keys.
    const mockApp = createMockApp({
      name: "test",
      healthResponse: { status: "healthy", service: "shop-mosi-backend" },
    });
    const res = await mockApp.app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      status: "healthy",
      service: "shop-mosi-backend",
    });
  });
});

describe("auto-injection of 400 response", () => {
  test("routes with request schema and without explicit 400 include 400 in spec", () => {
    const app = createTestApp();

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/no-400",
        request: {
          query: z.object({ q: z.string().optional() }),
        },
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ ok: true }),
    );

    const spec = getSpec(app);
    const responses = spec.paths!["/api/no-400"].get!.responses!;
    expect(responses).toHaveProperty("400");
    expect(responses["400"].description).toBe("Validation error");
  });

  test("routes without request schema do NOT include 400 in spec", () => {
    const app = createTestApp();

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/no-request",
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ ok: true }),
    );

    const spec = getSpec(app);
    const responses = spec.paths!["/api/no-request"].get!.responses!;
    expect(responses).not.toHaveProperty("400");
  });

  test("routes with explicit 400 preserve explicit definition", () => {
    const app = createTestApp();

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/with-400",
        responses: {
          200: { description: "OK" },
          400: {
            description: "Custom bad request",
            content: {
              "application/json": {
                schema: z.object({ custom: z.string() }),
              },
            },
          },
        },
      }),
      (c) => c.json({ ok: true }),
    );

    const spec = getSpec(app);
    const responses = spec.paths!["/api/with-400"].get!.responses!;
    expect(responses).toHaveProperty("400");
    expect(responses["400"].description).toBe("Custom bad request");
  });

  test("rawOpenApi cannot override auto-injected 400 when route has no explicit 400", () => {
    const app = createTestApp();

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/raw-override",
        request: {
          query: z.object({ q: z.string().optional() }),
        },
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ ok: true }),
      {
        rawOpenApi: {
          responses: {
            400: {
              description: "Should not override",
            },
          },
        },
      },
    );

    const spec = getSpec(app);
    const responses = spec.paths!["/api/raw-override"].get!.responses!;
    expect(responses).toHaveProperty("400");
    // rawOpenApi is merged before auto-injection, so auto-injected 400 wins
    expect(responses["400"].description).toBe("Validation error");
  });

  test("rawOpenApi deep-merges nested objects and concatenates arrays", () => {
    const app = createTestApp();

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/deep-merge",
        request: {
          query: z.object({ q: z.string().optional() }),
        },
        responses: {
          200: { description: "OK" },
          404: { description: "Not found" },
        },
      }),
      (c) => c.json({ ok: true }),
      {
        rawOpenApi: {
          // responses: should merge, not replace — existing 200/404 preserved
          responses: {
            429: { description: "Too many requests" },
          },
          // operationId: scalar, replaced
          operationId: "deepMergeTest",
        },
      },
    );

    const spec = getSpec(app);
    const op = spec.paths!["/api/deep-merge"].get!;
    // Original responses preserved (200, 404) + auto-injected 400 + rawOpenApi 429
    const responses = op.responses!;
    expect(responses).toHaveProperty("200");
    expect(responses["200"].description).toBe("OK");
    expect(responses).toHaveProperty("404");
    expect(responses["404"].description).toBe("Not found");
    expect(responses).toHaveProperty("400");
    expect(responses).toHaveProperty("429");
    expect(responses["429"].description).toBe("Too many requests");
    // Scalar replaced
    expect(op.operationId).toBe("deepMergeTest");
  });
});

describe("defaultHook validation errors", () => {
  test("invalid query param returns { success: false, message: string } 400", async () => {
    const app = createTestApp({ openApi: false });

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/search",
        request: {
          query: z.object({ limit: z.coerce.number().min(1) }),
        },
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ ok: true }),
    );

    const res = await app.request("/api/search?limit=0");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("success");
    expect(body.success).toBe(false);
    expect(typeof body.message).toBe("string");
  });

  test("valid request body passes through without 400", async () => {
    const app = createTestApp({ openApi: false });

    app.openApiRoute(
      createRoute({
        method: "post",
        path: "/api/items",
        request: {
          body: {
            content: {
              "application/json": {
                schema: z.object({ name: z.string() }),
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ created: true }),
    );

    const res = await app.request("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "foo" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ created: true });
  });
});

describe("Content-Type enforcement for JSON body routes", () => {
  test("POST without Content-Type returns 415", async () => {
    const app = createTestApp({ openApi: false });

    app.openApiRoute(
      createRoute({
        method: "post",
        path: "/api/items",
        request: {
          body: {
            content: {
              "application/json": {
                schema: z.object({ name: z.string() }),
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
        },
      }),
      (c): any => {
        const body = c.req.valid("json");
        return c.json({ received: body });
      },
    );

    // POST JSON body without Content-Type header
    const res = await app.request("/api/items", {
      method: "POST",
      body: JSON.stringify({ name: "foo" }),
    });
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.message).toBe("Content-Type must be application/json");
  });

  test("POST with wrong Content-Type returns 415", async () => {
    const app = createTestApp({ openApi: false });

    app.openApiRoute(
      createRoute({
        method: "post",
        path: "/api/items2",
        request: {
          body: {
            content: {
              "application/json": {
                schema: z.object({ name: z.string() }),
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
        },
      }),
      (c): any => c.json({ ok: true }),
    );

    const res = await app.request("/api/items2", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ name: "foo" }),
    });
    expect(res.status).toBe(415);
  });

  test("POST with application/json charset passes through", async () => {
    const app = createTestApp({ openApi: false });

    app.openApiRoute(
      createRoute({
        method: "post",
        path: "/api/items3",
        request: {
          body: {
            content: {
              "application/json": {
                schema: z.object({ name: z.string() }),
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
        },
      }),
      (c): any => c.json({ ok: true }),
    );

    const res = await app.request("/api/items3", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ name: "foo" }),
    });
    expect(res.status).toBe(200);
  });

  test("route without body schema does not enforce Content-Type", async () => {
    const app = createTestApp({ openApi: false });

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/no-body",
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ ok: true }),
    );

    const res = await app.request("/api/no-body");
    expect(res.status).toBe(200);
  });

  test("application/jsonp Content-Type is rejected (not a substring match)", async () => {
    const app = createTestApp({ openApi: false });

    app.openApiRoute(
      createRoute({
        method: "post",
        path: "/api/jsonp-test",
        request: {
          body: {
            content: {
              "application/json": {
                schema: z.object({ name: z.string() }),
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
        },
      }),
      (c): any => c.json({ ok: true }),
    );

    const res = await app.request("/api/jsonp-test", {
      method: "POST",
      headers: { "Content-Type": "application/jsonp" },
      body: "callback({name:'foo'})",
    });
    expect(res.status).toBe(415);
  });

  test("415 response is auto-injected in spec for JSON body routes", () => {
    const app = createTestApp();

    app.openApiRoute(
      createRoute({
        method: "post",
        path: "/api/spec-415",
        request: {
          body: {
            content: {
              "application/json": {
                schema: z.object({ name: z.string() }),
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
        },
      }),
      (c): any => c.json({ ok: true }),
    );

    const spec = getSpec(app);
    const responses = spec.paths!["/api/spec-415"].post!.responses!;
    expect(responses).toHaveProperty("415");
    expect(responses["415"].description).toBe("Unsupported Media Type");
  });

  test("explicit 415 in route is preserved (not overwritten)", () => {
    const app = createTestApp();

    app.openApiRoute(
      createRoute({
        method: "post",
        path: "/api/explicit-415",
        request: {
          body: {
            content: {
              "application/json": {
                schema: z.object({ name: z.string() }),
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
          415: { description: "Custom unsupported" },
        },
      }),
      (c): any => c.json({ ok: true }),
    );

    const spec = getSpec(app);
    const responses = spec.paths!["/api/explicit-415"].post!.responses!;
    expect(responses["415"].description).toBe("Custom unsupported");
  });

  test("Content-Type middleware only applies to declared method, not other methods", async () => {
    const app = createTestApp({ openApi: false });

    // Register a POST route with JSON body
    app.openApiRoute(
      createRoute({
        method: "post",
        path: "/api/method-scope",
        request: {
          body: {
            content: {
              "application/json": {
                schema: z.object({ name: z.string() }),
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
        },
      }),
      (c): any => c.json({ ok: true }),
    );

    // Register a GET route on the same path
    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/method-scope",
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ items: [] }),
    );

    // GET should work without Content-Type (not blocked by POST's CT check)
    const getRes = await app.request("/api/method-scope");
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody).toEqual({ items: [] });
  });

  test("auth middleware only applies to declared method, not other methods", async () => {
    const app = createTestApp({ openApi: false });

    // Register a protected POST route
    app.openApiRoute(
      createRoute({
        method: "post",
        path: "/api/auth-method-scope",
        responses: {
          200: { description: "OK" },
        },
      }),
      (c): any => c.json({ ok: true }),
      { auth: "required" },
    );

    // Register an unprotected GET route on the same path
    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/auth-method-scope",
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ public: true }),
    );

    // POST without auth → 401
    const postRes = await app.request("/api/auth-method-scope", { method: "POST" });
    expect(postRes.status).toBe(401);

    // GET without auth → 200 (not blocked by POST's auth check)
    const getRes = await app.request("/api/auth-method-scope");
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody).toEqual({ public: true });
  });

  test("CT middleware on parameterized route does not block sibling static routes", async () => {
    const app = createTestApp({ openApi: false });

    // Register the STATIC sibling first so Hono routes to it
    app.openApiRoute(
      createRoute({
        method: "post",
        path: "/api/data/bulk",
        responses: {
          200: { description: "OK" },
        },
      }),
      (c): any => c.json({ bulk: true }),
    );

    // Register a parameterized route with JSON body (handler wrapping, no hono.use)
    app.openApiRoute(
      createRoute({
        method: "post",
        path: "/api/data/{id}",
        request: {
          body: {
            content: {
              "application/json": {
                schema: z.object({ value: z.string() }),
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
        },
      }),
      (c): any => c.json({ ok: true }),
    );

    // Static sibling POST without Content-Type should work (not 415)
    const res = await app.request("/api/data/bulk", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ bulk: true });

    // Parameterized route should still enforce CT
    const resBadCT = await app.request("/api/data/abc", {
      method: "POST",
      body: JSON.stringify({ value: "test" }),
    });
    expect(resBadCT.status).toBe(415);
  });
});

describe("onError JSON parse handling", () => {
  test("malformed JSON body returns { error: Invalid JSON body } 400", async () => {
    const app = createTestApp({ openApi: false });

    app.openApiRoute(
      createRoute({
        method: "post",
        path: "/api/items",
        request: {
          body: {
            content: {
              "application/json": {
                schema: z.object({ name: z.string() }),
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ created: true }),
    );

    const res = await app.request("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe("Invalid JSON body");
  });
});

describe("startServer compatibility", () => {
  test("startServer accepts MockAppV2 without API changes", async () => {
    const { startServer } = await import("../index");
    const mockApp: MockAppV2 = createMockApp({ name: "compat", port: 0 });

    // Capture the arguments passed to Bun.serve without opening a real socket
    let capturedArgs: any;
    const originalServe = Bun.serve;
    Bun.serve = (args: any) => {
      capturedArgs = args;
      return { stop: () => {} } as any;
    };

    try {
      const server = await startServer(mockApp);

      // Assert that Bun.serve was called with the correct arguments
      expect(capturedArgs).toBeDefined();
      expect(capturedArgs.port).toBe(0);
      expect(capturedArgs.fetch).toBe(mockApp.app.fetch);

      // Assert that the returned object exposes a stop function
      expect(server).toBeDefined();
      expect(typeof server.stop).toBe("function");
    } finally {
      Bun.serve = originalServe;
    }
  });
});
