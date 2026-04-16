import type { AppEnv, CreateMockAppOptions, MockApp } from "./types";
import { Hono } from "hono";

const DEFAULT_PORT = 3000;

/**
 * Factory function to create a mock application.
 *
 * Each mock calls this to get a Hono app pre-configured with:
 * - A /health endpoint
 * - The mock's config bound to context
 * - Optional custom route registration
 *
 * No global state — each call produces an independent app instance.
 */
export function createMockApp(options: CreateMockAppOptions): MockApp {
  const config = {
    name: options.name,
    port: options.port ?? DEFAULT_PORT,
    dev: options.dev ?? false,
  };

  const app = new Hono<AppEnv>();

  // Built-in health check endpoint
  app.get("/health", (c) => {
    return c.json(
      options.healthResponse ?? { ok: true, status: "healthy", service: config.name },
    );
  });

  // Register custom routes if provided
  if (options.routes) {
    options.routes(app);
  }

  return { config, app };
}
