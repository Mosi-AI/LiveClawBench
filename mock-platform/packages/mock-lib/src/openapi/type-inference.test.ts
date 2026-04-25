import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { createOpenAPIMockApp } from "./create-app";
import type { OpenAPIApp } from "./types";

/**
 * Type utility to detect if T is `any`.
 * When T = any, `1 & any` = `any`, and `0 extends any` = true.
 * For any other type T, `1 & T` = `1`, and `0 extends 1` = false.
 */
type IsAny<T> = 0 extends (1 & T) ? true : false;

describe("type-inference — route config provides typed validation", () => {
  test("query and params are typed via hono.openapi (not any)", async () => {
    const mockApp = createOpenAPIMockApp({ name: "test", port: 0 });
    const app = mockApp.app as OpenAPIApp;

    const route = createRoute({
      method: "get",
      path: "/items/:id",
      request: {
        query: z.object({ q: z.string(), page: z.coerce.number().optional() }),
        params: z.object({ id: z.string() }),
      },
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: z.object({ ok: z.boolean(), id: z.string() }),
            },
          },
        },
      },
    });

    // Use app.openapi() directly for compile-time type inference tests.
    // openApiRoute() uses Handler<AppEnv> (relaxed) so mock handlers can
    // return error statuses not declared in the route schema.
    app.openapi(route, (c) => {
      const query = c.req.valid("query");
      const params = c.req.valid("param");

      // Compile-time assertions: types must NOT be `any`
      const _queryNotAny: IsAny<typeof query> extends false ? true : never = true;
      const _paramsNotAny: IsAny<typeof params> extends false ? true : never = true;

      // Property access with correct types
      const _q: string = query.q;
      const _page: number | undefined = query.page;
      const _id: string = params.id;

      return c.json({ ok: true, id: params.id }, 200);
    });

    const res = await app.request("/items/abc?q=search&page=2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, id: "abc" });
  });

  test("JSON body via request.body is typed via hono.openapi (not any)", async () => {
    const mockApp = createOpenAPIMockApp({ name: "test", port: 0 });
    const app = mockApp.app as OpenAPIApp;

    const route = createRoute({
      method: "post",
      path: "/users",
      request: {
        body: {
          content: {
            "application/json": {
              schema: z.object({ name: z.string(), age: z.number() }),
            },
          },
        },
      },
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: z.object({ created: z.boolean() }),
            },
          },
        },
      },
    });

    app.openapi(route, (c) => {
      const json = c.req.valid("json");

      // Compile-time assertion: must NOT be `any`
      const _jsonNotAny: IsAny<typeof json> extends false ? true : never = true;

      // Property access with correct types
      const _name: string = json.name;
      const _age: number = json.age;

      return c.json({ created: true }, 200);
    });

    const res = await app.request("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice", age: 30 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ created: true });
  });

  test("coerce.number() yields number type in query params", async () => {
    const mockApp = createOpenAPIMockApp({ name: "test", port: 0 });
    const app = mockApp.app as OpenAPIApp;

    const route = createRoute({
      method: "get",
      path: "/search",
      request: {
        query: z.object({
          min: z.coerce.number(),
          max: z.coerce.number(),
          limit: z.coerce.number().optional(),
        }),
      },
      responses: {
        200: { description: "OK" },
      },
    });

    app.openapi(route, (c) => {
      const query = c.req.valid("query");

      // z.coerce.number() should yield `number`, not `string`
      const _min: number = query.min;
      const _max: number = query.max;
      const _limit: number | undefined = query.limit;

      return c.json({ ok: true });
    });

    const res = await app.request("/search?min=10&max=100&limit=50");
    expect(res.status).toBe(200);
  });
});

describe("type-inference — @ts-expect-error negative cases", () => {
  test("plain object without createRoute() is rejected by TypeScript", () => {
    const mockApp = createOpenAPIMockApp({ name: "test", port: 0 });
    const app = mockApp.app as OpenAPIApp;

    try {
      // @ts-expect-error — plain object without createRoute() wrapper
      app.openApiRoute({ method: "get", path: "/bad" }, (c) => c.json({}));
    } catch {
      // Expected runtime crash: route.responses is undefined
    }
  });

  test("wrong property type on validated query is rejected by TypeScript", () => {
    const mockApp = createOpenAPIMockApp({ name: "test", port: 0 });
    const app = mockApp.app as OpenAPIApp;

    const route = createRoute({
      method: "get",
      path: "/items",
      request: {
        query: z.object({ q: z.string() }),
      },
      responses: {
        200: { description: "OK" },
      },
    });

    // Test via app.openapi() for compile-time type checking
    app.openapi(route, (c) => {
      const query = c.req.valid("query");

      // @ts-expect-error — query.q is string, not number
      const _bad: number = query.q;

      // @ts-expect-error — nonExistent is not a key of the query schema
      const _missing: string = query.nonExistent;

      return c.json({ ok: true });
    });
  });

  test("c.req.valid() with undefined target is rejected by TypeScript", () => {
    const mockApp = createOpenAPIMockApp({ name: "test", port: 0 });
    const app = mockApp.app as OpenAPIApp;

    const route = createRoute({
      method: "get",
      path: "/items",
      request: {
        query: z.object({ q: z.string() }),
      },
      responses: {
        200: { description: "OK" },
      },
    });

    // Test via app.openapi() for compile-time type checking
    app.openapi(route, (c) => {
      // @ts-expect-error — "json" not valid when only query is defined
      const _noJson = c.req.valid("json");

      // @ts-expect-error — "param" not valid when only query is defined
      const _noParam = c.req.valid("param");

      return c.json({ ok: true });
    });
  });
});
