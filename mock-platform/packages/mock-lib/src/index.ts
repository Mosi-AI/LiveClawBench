// mock-lib: shared framework for LiveClawBench mock services

// Types
export type { MockConfig, MockApp, AppEnv, CreateMockAppOptions } from "./types";

// Factory
export { createMockApp } from "./create-app";

// Server
export { startServer } from "./server";

// Auth
export { sign, verify, _resetSecret, tokenCookieOptions } from "./auth";
export type { JwtPayload, TokenCookieOptions } from "./auth";
export { authRequired, authOptional } from "./auth";

// Database
export { getDb, resetDb, migrate } from "./db";
export { JsonStore } from "./db";
export type { SqliteOptions, JsonStoreOptions } from "./db";

// Render (stub — Plan 2 implements)
export { registerStaticAssets, renderTemplate } from "./render";
export type { TemplateData } from "./render";
