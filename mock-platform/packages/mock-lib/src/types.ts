import type { Hono } from "hono";

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
  /** Custom route registration callback. Receives the OpenAPI-enabled app. */
  routes?: (app: import("./openapi/types").OpenAPIApp) => void;
  /** Health check response body. Defaults to { status: "healthy", service: config.name } */
  healthResponse?: Record<string, unknown>;
  /** OpenAPI document generation configuration */
  openApi?: OpenApiConfig;
}
