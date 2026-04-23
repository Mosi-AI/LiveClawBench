import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { AppEnv, MockConfig } from "../types";
import type { OpenAPIApp, MockAppV2, RouteOptions } from "./types";
import { FactoryValidationSchema } from "./schemas";

const DEFAULT_PORT = 3000;

/**
 * Configuration for OpenAPI document generation.
 */
export interface OpenApiConfig {
  /** Enable OpenAPI document generation and the /openapi.json endpoint */
  enabled?: boolean;
  /** OpenAPI document title */
  title?: string;
  /** OpenAPI document version */
  version?: string;
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
    dev: config.dev ?? false,
  };

  // Create OpenAPIHono with custom defaultHook for validation errors
  const hono = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json({ error: result.error.message }, 400);
      }
    },
  });

  // Cast to our extended interface
  const app = hono as unknown as OpenAPIApp;

  // page(): register plain GET routes excluded from OpenAPI docs
  app.page = (path: string, handler: Parameters<typeof hono.get>[1]) => {
    hono.get(path, handler);
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
    // Deep-clone route to avoid mutating caller's object
    const mergedRoute: RouteConfig = { ...route };

    // Auto-inject 400 validation response if not explicitly defined
    const has400 = Object.keys(mergedRoute.responses).some(
      (k) => k === "400" || k === "4XX",
    );
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

    // Merge rawOpenApi metadata over auto-generated fields
    if (options?.rawOpenApi) {
      Object.assign(mergedRoute, options.rawOpenApi);
    }

    hono.openapi(mergedRoute as R, handler);
  };

  // Catch SyntaxError from invalid JSON bodies
  app.onError((err, c) => {
    if (err instanceof SyntaxError) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    // Re-throw for default Hono error handling
    throw err;
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
  if (openApi?.enabled) {
    app.doc31("/openapi.json", {
      openapi: "3.1.0",
      info: {
        title: openApi.title ?? resolvedConfig.name,
        version: openApi.version ?? "1.0.0",
      },
    });

    // Register bearerAuth security scheme
    app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    });
  }

  return { config: resolvedConfig, app };
}
