import type { MockAppV2 } from "./openapi/types";
import { parseCliPort } from "./cli";

/**
 * Start the mock HTTP server using Bun's native HTTP server.
 *
 * - Uses --port CLI flag if provided, otherwise falls back to config.port
 * - In dev mode: enables Hono logger middleware
 * - Calls mockApp.seed() directly if present
 * - Seed failures are fatal: the process exits with code 1
 *
 * @returns Bun server instance for lifecycle management (shutdown, health checks, etc.)
 */
export async function startServer(
  mockApp: MockAppV2,
  options?: {
    /** Dev mode: enable Hono logger. Defaults to mockApp.config.dev */
    dev?: boolean;
  },
): Promise<ReturnType<typeof Bun.serve>> {
  const dev = options?.dev ?? mockApp.config.dev ?? false;
  // Propagate the resolved dev value back into mockApp.config so request-time
  // closures (e.g. the /openapi.json runtime gate in createOpenAPIMockApp) see
  // the same value as the logger middleware below. Without this write, the
  // construction-time view of `config.dev` and the startServer override would
  // disagree.
  mockApp.config.dev = dev;
  const cliPort = parseCliPort();
  const port = cliPort ?? mockApp.config.port ?? 3000;

  // Apply dev mode middleware
  if (dev) {
    const { logger } = await import("hono/logger");
    mockApp.app.use("*", logger());
  }

  // Run seed from mockApp.seed if present (fatal: exit on seed failure)
  if (mockApp.seed) {
    try {
      await mockApp.seed();
    } catch (err) {
      console.error(`mock-${mockApp.config.name}: FATAL: seed() failed`, err);
      process.exit(1);
    }
  }

  // Start Bun's native HTTP server
  const server = Bun.serve({
    port,
    fetch: mockApp.app.fetch,
  });

  console.log(
    `mock-${mockApp.config.name} listening on http://localhost:${port}`,
  );

  return server;
}
