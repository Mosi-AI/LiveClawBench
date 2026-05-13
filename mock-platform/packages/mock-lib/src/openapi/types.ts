import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { Handler } from "hono";
import type { AppEnv, MockConfig } from "../types";

export { createRoute } from "@hono/zod-openapi";
export type { RouteConfig } from "@hono/zod-openapi";

/**
 * Extended OpenAPIHono app with mock-lib specific helpers.
 *
 * `page()` registers plain GET routes (HTML pages) that are NOT exposed
 * in the OpenAPI document.  `openApiRoute()` registers typed API routes
 * that ARE exposed in the OpenAPI document with automatic 400 validation
 * response injection and optional bearer-auth security.
 */
export interface OpenAPIApp extends OpenAPIHono<AppEnv> {
  /**
   * Register a plain GET route for HTML pages.
   *
   * These routes are added to the Hono router but excluded from the
   * OpenAPI registry so they do not appear in `/openapi.json`.
   */
  page(path: string, handler: Handler<AppEnv>): void;

  /**
   * Register a typed OpenAPI route.
   *
   * Automatically injects a 400 validation-error response schema when
   * none is explicitly defined, and adds bearer-auth security when
   * `auth: "required"` is set.
   *
   * The handler parameter uses a relaxed type so that `ok()`/`err()` helper
   * return types don't need to satisfy the full Zod schema inference.
   * Runtime validation is enforced by Zod; response shapes are verified by
   * bun:test integration tests.
   */
  openApiRoute<R extends RouteConfig>(
    route: R,
    handler: (c: any) => any,
    options?: RouteOptions,
  ): void;
}

/**
 * Options for `openApiRoute()`.
 */
export interface RouteOptions {
  /** Authentication mode for this route */
  auth?: "optional" | "required";
  /** Raw OpenAPI metadata merged over auto-generated fields */
  rawOpenApi?: Record<string, unknown>;
}

/**
 * Assembled mock application using the OpenAPI-enabled app.
 */
export interface MockAppV2 {
  /** The configuration this app was created with */
  config: MockConfig;
  /** The OpenAPI-enabled Hono application instance */
  app: OpenAPIApp;
  /** Resolved OpenAPI document info (title, version) for spec generation */
  openApiInfo?: { title: string; version: string };
  /** Optional seed function for initializing mock data (databases, products, etc.) */
  seed?: () => void | Promise<void>;
}
