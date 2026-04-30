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
 * - Optional SPA frontend serving when `frontendDir` is set
 *
 * No global state — each call produces an independent app instance.
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
  // Routes registered here (API endpoints) take precedence over SPA fallback.
  if (options.routes) {
    options.routes(mockApp.app);
  }

  // SPA frontend serving: static files + catch-all fallback.
  // Order matters — API routes are already registered above, so they match first.
  // serveStatic only responds to existing files; the catch-all returns index.html.
  if (options.frontendDir) {
    // Serve static assets (JS, CSS, images) from the frontend directory.
    // serveStatic calls next() when no matching file exists.
    mockApp.app.use("/*", serveStatic({ root: options.frontendDir }));

    // SPA fallback: return index.html for any request that didn't match
    // an API route or static file. This enables React Router client-side routing.
    mockApp.app.get("*", async (c) => {
      const file = Bun.file(`${options.frontendDir}/index.html`);
      const html = await file.text();
      return c.html(html);
    });
  }

  return mockApp;
}
