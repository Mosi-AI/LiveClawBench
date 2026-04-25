import type { AppEnv, CreateMockAppOptions } from "./types";
import type { MockAppV2, OpenAPIApp } from "./openapi/types";
import { createOpenAPIMockApp } from "./openapi/create-app";

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

  // Register custom routes via backward-compatible callback
  if (options.routes) {
    options.routes(mockApp.app);
  }

  return mockApp;
}
