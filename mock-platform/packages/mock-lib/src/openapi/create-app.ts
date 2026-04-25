import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { Handler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv, MockConfig, OpenApiConfig } from "../types";
import type { OpenAPIApp, MockAppV2, RouteOptions } from "./types";
import { FactoryValidationSchema } from "./schemas";

const DEFAULT_PORT = 3000;

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
    dev: config.dev ?? false,
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

    // Merge rawOpenApi metadata first
    if (options?.rawOpenApi) {
      Object.assign(mergedRoute, options.rawOpenApi);
    }

    // Auto-inject 400 validation response only when the ORIGINAL route has no explicit 400/4XX
    // rawOpenApi cannot prevent auto-injection
    // Note: runtime guard for compile-contract tests that use @ts-expect-error
    const has400 =
      route.responses !== undefined &&
      Object.keys(route.responses).some((k) => k === "400" || k === "4XX");
    if (!has400) {
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

    // Add bearer-auth security when auth is required
    if (options?.auth === "required") {
      mergedRoute.security = [{ bearerAuth: [] }];
    }

    // Type assertion needed: @hono/zod-openapi ships duplicate type definitions
    // from its @asteasolutions/zod-to-openapi dependency, causing "two different
    // types with this name exist, but they are unrelated" errors.
    hono.openapi(mergedRoute as R, handler as any);
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

  // Built-in health check endpoint
  app.get("/health", (c) => {
    return c.json(
      healthResponse ?? {
        ok: true,
        status: "healthy",
        service: resolvedConfig.name,
      },
    );
  });

  // Register /openapi.json and bearerAuth security scheme when enabled
  const resolvedInfo = openApi?.enabled
    ? {
        title: openApi.title ?? resolvedConfig.name,
        version: openApi.version ?? "1.0.0",
      }
    : undefined;

  if (openApi?.enabled) {
    app.doc31("/openapi.json", {
      openapi: "3.1.0",
      info: resolvedInfo,
    });

    // Register bearerAuth security scheme
    app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    });
  }

  return { config: resolvedConfig, app, openApiInfo: resolvedInfo };
}
