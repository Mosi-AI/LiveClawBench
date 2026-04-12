import type { Hono } from "hono";

/**
 * Configuration for a mock service instance.
 */
export interface MockConfig {
  /** Unique mock name (e.g., "airline", "shop") — used for binary identification */
  name: string;
  /** Port to listen on. Overridden by --port CLI flag at startup. */
  port?: number;
  /** Enable development mode: Hono logger + file watch/reload */
  dev?: boolean;
}

/**
 * Hono environment type with bound variables.
 * Each mock extends this with its own typed variables.
 */
export type AppEnv = {
  Variables: {
    /** Authenticated user ID, set by auth middleware when a valid JWT is present */
    userId?: number;
  };
};

/**
 * The assembled mock application.
 * Returned by createMockApp() and consumed by startServer().
 */
export interface MockApp {
  /** The configuration this app was created with */
  config: MockConfig;
  /** The Hono application instance */
  app: Hono<AppEnv>;
}

/**
 * Options for the createMockApp factory.
 */
export interface CreateMockAppOptions extends MockConfig {
  /** Custom route registration callback. Receives the Hono app to add routes. */
  routes?: (app: Hono<AppEnv>) => void;
  /** Health check response body. Defaults to { ok: true } */
  healthResponse?: Record<string, unknown>;
}
