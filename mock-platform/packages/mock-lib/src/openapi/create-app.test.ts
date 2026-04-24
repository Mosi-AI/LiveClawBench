import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createMockApp, createRoute } from "../index";
import type { MockAppV2, OpenAPIApp } from "../index";

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
    const mockApp = createMockApp({
      name: "test",
      openApi: { enabled: true },
    });
    const app = mockApp.app as OpenAPIApp;

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

    const spec = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "test", version: "1.0.0" },
    });
    expect(spec.paths).toHaveProperty("/api/items");
    expect(spec.paths!["/api/items"]).toHaveProperty("get");
  });
});

describe("page() — exclusion from OpenAPI spec", () => {
  test("page routes do NOT appear in spec.paths", () => {
    const mockApp = createMockApp({
      name: "test",
      openApi: { enabled: true },
    });
    const app = mockApp.app as OpenAPIApp;

    app.page("/", (c) => c.html("<h1>Home</h1>") as any);
    app.page("/about", (c) => c.html("<h1>About</h1>") as any);

    const spec = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "test", version: "1.0.0" },
    });
    expect(spec.paths).not.toHaveProperty("/");
    expect(spec.paths).not.toHaveProperty("/about");
  });
});

describe("auth security field", () => {
  test("auth: required generates security: [{ bearerAuth: [] }]", () => {
    const mockApp = createMockApp({
      name: "test",
      openApi: { enabled: true },
    });
    const app = mockApp.app as OpenAPIApp;

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

    const spec = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "test", version: "1.0.0" },
    });
    const route = spec.paths!["/api/protected"].get!;
    expect(route.security).toEqual([{ bearerAuth: [] }]);
  });

  test("components.securitySchemes.bearerAuth exists when openApi.enabled", () => {
    const mockApp = createMockApp({
      name: "test",
      openApi: { enabled: true },
    });
    const app = mockApp.app as OpenAPIApp;

    const spec = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "test", version: "1.0.0" },
    });
    expect(spec.components?.securitySchemes).toHaveProperty("bearerAuth");
    expect((spec.components?.securitySchemes as any)?.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
  });

  test("auth: optional (default) does NOT generate security field", () => {
    const mockApp = createMockApp({
      name: "test",
      openApi: { enabled: true },
    });
    const app = mockApp.app as OpenAPIApp;

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

    const spec = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "test", version: "1.0.0" },
    });
    const route = spec.paths!["/api/public"].get!;
    expect(route.security).toBeUndefined();
  });
});

describe("auto-injection of 400 response", () => {
  test("routes without explicit 400 include 400 in spec", () => {
    const mockApp = createMockApp({
      name: "test",
      openApi: { enabled: true },
    });
    const app = mockApp.app as OpenAPIApp;

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/no-400",
        responses: {
          200: { description: "OK" },
        },
      }),
      (c) => c.json({ ok: true }),
    );

    const spec = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "test", version: "1.0.0" },
    });
    const responses = spec.paths!["/api/no-400"].get!.responses!;
    expect(responses).toHaveProperty("400");
    expect(responses["400"].description).toBe("Validation error");
  });

  test("routes with explicit 400 preserve explicit definition", () => {
    const mockApp = createMockApp({
      name: "test",
      openApi: { enabled: true },
    });
    const app = mockApp.app as OpenAPIApp;

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

    const spec = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "test", version: "1.0.0" },
    });
    const responses = spec.paths!["/api/with-400"].get!.responses!;
    expect(responses).toHaveProperty("400");
    expect(responses["400"].description).toBe("Custom bad request");
  });

  test("rawOpenApi cannot override auto-injected 400 when route has no explicit 400", () => {
    const mockApp = createMockApp({
      name: "test",
      openApi: { enabled: true },
    });
    const app = mockApp.app as OpenAPIApp;

    app.openApiRoute(
      createRoute({
        method: "get",
        path: "/api/raw-override",
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

    const spec = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "test", version: "1.0.0" },
    });
    const responses = spec.paths!["/api/raw-override"].get!.responses!;
    expect(responses).toHaveProperty("400");
    // rawOpenApi is merged before auto-injection, so auto-injected 400 wins
    expect(responses["400"].description).toBe("Validation error");
  });
});

describe("defaultHook validation errors", () => {
  test("invalid query param returns { error: string } 400", async () => {
    const mockApp = createMockApp({ name: "test" });
    const app = mockApp.app as OpenAPIApp;

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
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });

  test("valid request body passes through without 400", async () => {
    const mockApp = createMockApp({ name: "test" });
    const app = mockApp.app as OpenAPIApp;

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

describe("onError JSON parse handling", () => {
  test("malformed JSON body returns { error: Invalid JSON body } 400", async () => {
    const mockApp = createMockApp({ name: "test" });
    const app = mockApp.app as OpenAPIApp;

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
    expect(body.error).toBe("Invalid JSON body");
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
