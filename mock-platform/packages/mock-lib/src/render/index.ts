/**
 * Render module — static asset serving for Hono mock services.
 *
 * Provides registerStaticAssets() for serving static files (CSS, JS, data)
 * from a filesystem directory. Each mock app imports its TSX components
 * directly — no template registry or string-based template lookup needed.
 */

import type { Hono } from "hono";
import type { AppEnv } from "../types";
import { serveStatic } from "hono/bun";

/**
 * Options for registering static asset serving on a Hono app.
 */
export interface StaticAssetsOptions {
  /** Absolute path to the directory containing static assets */
  dir: string;
  /**
   * URL path prefix where assets are served (e.g., "/static").
   * If omitted, assets are served from the root.
   */
  prefix?: string;
}

/**
 * Register static asset serving middleware on a Hono app.
 *
 * Uses Hono's serveStatic adapter for Bun to serve files from disk.
 * The middleware only responds to requests that match an existing file;
 * all other requests fall through to route handlers.
 *
 * @example
 * ```ts
 * // Serve files from /opt/mock/static/shop/ at /static/*
 * registerStaticAssets(app, { dir: "/opt/mock/static/shop", prefix: "/static" });
 * ```
 */
export function registerStaticAssets(
  app: Hono<AppEnv>,
  options: StaticAssetsOptions,
): void {
  const { dir, prefix } = options;

  app.use(
    prefix ? `${prefix}/*` : "/*",
    serveStatic({
      root: dir,
      rewriteRequestPath: (path: string) =>
        prefix ? path.slice(prefix.length) : path,
    }),
  );
}
