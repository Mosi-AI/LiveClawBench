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
 * - Logs and continues if seed() throws (non-blocking for production)
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
): Promise<Server> {
  const dev = options?.dev ?? mockApp.config.dev ?? false;
  const port = parseCliPort() ?? mockApp.config.port ?? 3000;

  // Apply dev mode middleware
  if (dev) {
    const { logger } = await import("hono/logger");
    mockApp.app.use("*", logger());
  }

  // Run seed callback if provided (non-blocking: log error but continue startup)
  if (options?.seed) {
    try {
      await options.seed();
    } catch (err) {
      console.error(
        `mock-${mockApp.config.name}: seed() failed, continuing startup`,
        err,
      );
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
