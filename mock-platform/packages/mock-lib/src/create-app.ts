import type { AppEnv, CreateMockAppOptions } from "./types";
import type { MockAppV2, OpenAPIApp } from "./openapi/types";
import { createOpenAPIMockApp } from "./openapi/create-app";
import { serveStatic } from "hono/bun";

const DEFAULT_PORT = 3000;

/**
 * Factory function to create a mock application.
 *
 * Each mock calls this to get an OpenAPI-enabled Hono app pre-configured with:
 * - A /health endpoint
 * - The mock's config bound to context
 * - Optional custom route registration (backward-compatible `routes` callback)
 * - OpenAPI document generation when `openApi.enabled` is true
 *
 * No global state — each call produces an independent app instance.
 *
 * IMPORTANT: If `frontendDir` is set, call `registerFrontendFallback(mockApp, dir)`
 * AFTER registering all API routes. The SPA catch-all must be registered last
 * to avoid intercepting API routes.
 */
export function createMockApp(options: CreateMockAppOptions): MockAppV2 {
  const config = {
    name: options.name,
    port: options.port ?? DEFAULT_PORT,
    dev: options.dev,
  };

  const mockApp = createOpenAPIMockApp(
    config,
    options.openApi,
    options.healthResponse,
  );

  // Register custom routes via backward-compatible callback.
  if (options.routes) {
    options.routes(mockApp.app);
  }

  return mockApp;
}

/**
 * Register SPA frontend serving (static files + catch-all fallback).
 *
 * MUST be called AFTER all API route registrations. The catch-all `app.get("*", ...)`
 * intercepts unmatched GET requests, so registering it before API routes would
 * swallow them.
 *
 * API namespace paths (/api/*, /health, /openapi.json) are rejected with 404
 * to prevent silent API regressions.
 */
export function registerFrontendFallback(
  app: OpenAPIApp,
  frontendDir: string,
): void {
  // Serve static assets (JS, CSS, images) from the frontend directory.
  app.use("/*", serveStatic({ root: frontendDir }));

  // SPA fallback: return index.html for non-API requests that didn't match
  // a registered route or static file.
  app.get("*", async (c) => {
    const path = new URL(c.req.url).pathname;
    if (
      path.startsWith("/api/") ||
      path === "/health" ||
      path === "/openapi.json"
    ) {
      return c.json({ error: "Not Found" }, 404);
    }
    const file = Bun.file(`${frontendDir}/index.html`);
    const html = await file.text();
    return c.html(html);
  });
}
