// mock-lib: shared framework for LiveClawBench mock services

// Types
export type { MockConfig, MockApp, AppEnv, CreateMockAppOptions, OpenApiConfig } from "./types";

// Response helpers
export type { ApiResponse } from "./response";
export { ok, err } from "./response";

// Factory
export { createMockApp, registerFrontendFallback } from "./create-app";

// Server
export { startServer } from "./server";

// Auth
export { sign, verify, _resetSecret, tokenCookieOptions, serializeCookie } from "./auth";
export type { JwtPayload, TokenCookieOptions } from "./auth";
export { authRequired, authOptional } from "./auth";
export type { AuthOptions } from "./auth";
export { BCRYPT_SALT_ROUNDS } from "./auth";

// Database
export { getDb, resetDb, migrate } from "./db";
export { JsonStore } from "./db";
export type { SqliteOptions, JsonStoreOptions } from "./db";

// Render
export { registerStaticAssets } from "./render";
export type { StaticAssetsOptions } from "./render";

// OpenAPI
export type { OpenAPIApp, MockAppV2, RouteOptions } from "./openapi/types";
export type { RouteConfig } from "./openapi/types";
export { createRoute } from "./openapi/types";
export { ErrorResponseSchema, FactoryValidationSchema } from "./openapi/schemas";
export { createOpenAPIMockApp } from "./openapi/create-app";

// Formatting
export { formatDateTime } from "./format";

// CLI
export { parseCliArgs, parseCliPort } from "./cli";
