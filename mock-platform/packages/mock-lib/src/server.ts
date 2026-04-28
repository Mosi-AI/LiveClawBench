import type { MockApp } from "./types";

/**
 * Parse --port CLI flag from process.argv.
 * Returns undefined if not specified (caller should use config default).
 */
function parseCliPort(): number | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" && args[i + 1]) {
      const port = parseInt(args[i + 1], 10);
      if (!isNaN(port) && port > 0 && port < 65536) {
        return port;
      }
    }
    if (args[i].startsWith("--port=")) {
      const port = parseInt(args[i].split("=")[1], 10);
      if (!isNaN(port) && port > 0 && port < 65536) {
        return port;
      }
    }
  }
  return undefined;
}

/**
 * Start the mock HTTP server using Bun's native HTTP server.
 *
 * - Uses --port CLI flag if provided, otherwise falls back to config.port
 * - In dev mode: enables Hono logger middleware
 * - Calls optional seed function before starting
 * - Seed failures are fatal: the process exits with code 1
 *
 * @returns Bun server instance for lifecycle management (shutdown, health checks, etc.)
 */
export async function startServer(
  mockApp: MockApp,
  options?: {
    /** Callback to seed initial data before server starts */
    seed?: () => Promise<void> | void;
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

  // Run seed callback if provided (fatal: exit on seed failure)
  if (options?.seed) {
    try {
      await options.seed();
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
