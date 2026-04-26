import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { Handler } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppEnv, MockConfig, OpenApiConfig } from "../types";
import type { OpenAPIApp, MockAppV2, RouteOptions } from "./types";
import { FactoryValidationSchema } from "./schemas";
import { authRequired } from "../auth/middleware";

const DEFAULT_PORT = 3000;

/** Check whether a route already declares a given status code (or 4XX wildcard). */
function hasStatusCode(route: RouteConfig, code: string): boolean {
  return (
    route.responses !== undefined &&
    Object.keys(route.responses).some((k) => k === code || k === "4XX")
  );
}

/**
 * Wrap a handler with a guard function.
 * Used for parameterized routes where hono.use() would overmatch sibling static routes.
 */
function wrapHandler(
  handler: any,
  guard: (c: any) => Response | undefined | Promise<Response | undefined>,
): any {
  return async (c: any): Promise<any> => {
    const result = await guard(c);
    if (result) return result;
    return handler(c);
  };
}

/**
 * Create an OpenAPI-enabled mock application.
 *
 * Returns a `MockAppV2` with an `OpenAPIApp` that supports:
 * - `page()` for HTML routes (excluded from OpenAPI docs)
 * - `openApiRoute()` for typed API routes (included in OpenAPI docs)
 * - Automatic 400 validation error injection
 * - Optional bearer-auth security per route
 * - SyntaxError handling for invalid JSON bodies
 */
export function createOpenAPIMockApp(
  config: MockConfig,
  openApi?: OpenApiConfig,
  healthResponse?: Record<string, unknown>,
): MockAppV2 {
  const resolvedConfig = {
    name: config.name,
    port: config.port ?? DEFAULT_PORT,
    // Dev mode: explicit config flag OR MOCK_DEV=1 env var. Gates the runtime
    // /openapi.json endpoint so it's reachable in local development but not
    // exposed inside benchmark task containers.
    dev: config.dev ?? process.env.MOCK_DEV === "1",
  };

  // Create OpenAPIHono with custom defaultHook for validation errors
  const hono = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const message = result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        return c.json({ error: message }, 400);
      }
    },
  });

  // Cast to our extended interface
  const app = hono as unknown as OpenAPIApp;

  // page(): register plain GET routes excluded from OpenAPI docs
  app.page = (path: string, handler: Handler<AppEnv>) => {
    hono.get(path, handler as any);
  };

  // openApiRoute(): register typed routes with auto-injected metadata
  app.openApiRoute = <
    R extends RouteConfig,
    H extends RouteHandler<R, AppEnv>,
  >(
    route: R,
    handler: H,
    options?: RouteOptions,
  ) => {
    // Shallow-copy route to avoid mutating top-level properties
    const mergedRoute: RouteConfig = { ...route };

    // Merge rawOpenApi metadata: arrays are concatenated, plain objects are
    // shallow-merged, and scalars are replaced. This preserves schema-derived
    // entries (e.g. Zod-generated parameters) when rawOpenApi adds extra
    // operation metadata like custom parameters or responses.
    if (options?.rawOpenApi) {
      for (const [key, value] of Object.entries(options.rawOpenApi)) {
        if (value == null) continue;
        const existing = (mergedRoute as Record<string, unknown>)[key];
        if (Array.isArray(existing) && Array.isArray(value)) {
          (mergedRoute as Record<string, unknown>)[key] = [...existing, ...value];
        } else if (
          existing &&
          typeof existing === "object" &&
          value &&
          typeof value === "object"
        ) {
          (mergedRoute as Record<string, unknown>)[key] = { ...existing, ...value };
        } else {
          (mergedRoute as Record<string, unknown>)[key] = value;
        }
      }
    }

    // Auto-inject 400 validation response only when the route actually validates
    // request input (query, params, headers, cookies, or body) AND the ORIGINAL
    // route has no explicit 400/4XX. Routes without request schemas cannot produce
    // Zod validation failures, so advertising 400 would make the spec inaccurate.
    // rawOpenApi cannot prevent auto-injection.
    // Note: runtime guard for compile-contract tests that use @ts-expect-error
    const hasRequestSchema =
      route.request !== undefined &&
      (route.request.query !== undefined ||
        route.request.params !== undefined ||
        route.request.headers !== undefined ||
        route.request.cookies !== undefined ||
        route.request.body !== undefined);

    if (hasRequestSchema && !hasStatusCode(route, "400")) {
      mergedRoute.responses = {
        ...mergedRoute.responses,
        400: {
          description: "Validation error",
          content: {
            "application/json": {
              schema: FactoryValidationSchema,
            },
          },
        },
      };
    }

    // Detect parameterized routes (e.g. /api/items/{id}) where hono.use() with
    // :param paths overmatches sibling static routes (e.g. /api/items/stats).
    // For parameterized routes, auth and CT checks use handler wrapping instead.
    const isParameterized = /\{\w+\}/.test(route.path);
    let finalHandler: any = handler;

    // Add bearer-auth security when auth is required
    if (options?.auth === "required") {
      mergedRoute.security = [{ bearerAuth: [] }];
      // Auto-inject 401 response when the route has no explicit 401
      if (!hasStatusCode(route, "401")) {
        mergedRoute.responses = {
          ...mergedRoute.responses,
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: FactoryValidationSchema,
              },
            },
          },
        };
      }

      if (isParameterized) {
        // Handler wrapping for parameterized routes: hono.use("/api/items/:id", ...)
        // would match /api/items/stats because :id is a catch-all segment.
        // Wrapping the handler avoids the overmatch at the cost of running auth
        // AFTER Zod validation (so 400 may precede 401). No current parameterized
        // routes use auth: "required", so this trade-off is acceptable.
        finalHandler = wrapHandler(finalHandler, (c) =>
          authRequired(c, async () => {}),
        );
      } else {
        // Non-parameterized: hono.use() matches the exact path, no overmatch risk.
        // Runs before hono.openapi() Zod validation so unauthenticated requests
        // get 401, not 400. Guard on method to avoid blocking other methods.
        const authMethod = route.method.toUpperCase();
        hono.use(route.path, async (c, next) => {
          if (c.req.method !== authMethod) return next();
          return authRequired(c, next);
        });
      }
    }

    // Enforce Content-Type: application/json for routes declaring JSON body schemas.
    // @hono/zod-openapi skips validation when Content-Type doesn't match, causing
    // c.req.valid("json") to return {} and handlers to run with undefined fields.
    // Return 415 (Unsupported Media Type) to fail fast instead of proceeding.
    if (
      mergedRoute.request?.body?.content?.["application/json"] &&
      !mergedRoute.request.body.content["application/*"]
    ) {
      // Auto-inject 415 response in spec when the route has no explicit 415/4XX
      if (!hasStatusCode(route, "415")) {
        mergedRoute.responses = {
          ...mergedRoute.responses,
          415: {
            description: "Unsupported Media Type",
            content: {
              "application/json": {
                schema: FactoryValidationSchema,
              },
            },
          },
        };
      }

      if (isParameterized) {
        // Handler wrapping for parameterized routes (same rationale as auth above).
        finalHandler = wrapHandler(finalHandler, (c) => {
          const ct = c.req.header("content-type") ?? "";
          const mediaType = ct.split(";")[0].trim().toLowerCase();
          if (mediaType !== "application/json") {
            return c.json({ error: "Content-Type must be application/json" }, 415);
          }
        });
      } else {
        // Non-parameterized: hono.use() matches the exact path.
        const mwMethod = route.method.toUpperCase();
        hono.use(mergedRoute.path, async (c, next) => {
          if (c.req.method !== mwMethod) return next();
          const ct = c.req.header("content-type") ?? "";
          // Parse media type token before ';' (charset) and reject substrings
          // like "application/jsonp" that would match includes("application/json").
          const mediaType = ct.split(";")[0].trim().toLowerCase();
          if (mediaType !== "application/json") {
            return c.json({ error: "Content-Type must be application/json" }, 415);
          }
          await next();
        });
      }
    }

    // Type assertion needed: @hono/zod-openapi ships duplicate type definitions
    // from its @asteasolutions/zod-to-openapi dependency, causing "two different
    // types with this name exist, but they are unrelated" errors.
    hono.openapi(mergedRoute as R, finalHandler as any);
  };

  // Catch JSON parse errors from invalid request bodies; return 500 for everything else
  app.onError((err, c) => {
    if (err instanceof SyntaxError) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    if (
      err instanceof HTTPException &&
      err.status === 400 &&
      err.message.includes("Malformed JSON")
    ) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    return c.json({ error: "Internal server error" }, 500);
  });

  // Built-in health check endpoint. Registered via openApiRoute so the route
  // appears in the generated OpenAPI specs alongside the rest of the API. The
  // response schema uses `.passthrough()` to accommodate arbitrary custom
  // healthResponse shapes (e.g. shop's `{ status, service }` without `ok`)
  // without runtime validation — Zod-OpenAPI does not validate response bodies.
  const healthRoute = createRoute({
    method: "get",
    path: "/health",
    tags: ["health"],
    summary: "Health check",
    responses: {
      200: {
        description: "Service is healthy",
        content: {
          "application/json": {
            schema: z
              .object({
                ok: z.boolean().optional(),
                status: z.string().optional(),
                service: z.string().optional(),
              })
              .passthrough(),
          },
        },
      },
    },
  });
  app.openApiRoute(healthRoute, ((c): any => {
    return c.json(
      healthResponse ?? {
        ok: true,
        status: "healthy",
        service: resolvedConfig.name,
      },
    );
  }) as RouteHandler<typeof healthRoute, AppEnv>);

  // Register /openapi.json and bearerAuth security scheme when enabled
  const resolvedInfo = openApi?.enabled
    ? {
        title: openApi.title ?? resolvedConfig.name,
        version: openApi.version ?? "1.0.0",
      }
    : undefined;

  if (openApi?.enabled) {
    // Register the /openapi.json route unconditionally and gate it at request
    // time. The middleware closure reads `resolvedConfig.dev` lazily, so
    // `startServer(app, { dev: true })` — which propagates the override into
    // `mockApp.config.dev` (same object as `resolvedConfig`) — flips the gate
    // even though the route was registered at construction time.
    hono.use("/openapi.json", async (c, next) => {
      if (!resolvedConfig.dev) return c.notFound();
      return next();
    });
    app.doc31("/openapi.json", {
      openapi: "3.1.0",
      info: resolvedInfo!,
    });

    // Register bearerAuth security scheme (needed for spec generation)
    app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    });
  }

  return { config: resolvedConfig, app, openApiInfo: resolvedInfo };
}
