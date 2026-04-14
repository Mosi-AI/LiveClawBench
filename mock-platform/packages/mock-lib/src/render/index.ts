/**
 * Render module — TSX template rendering via Hono JSX.
 *
 * API surface defined here for Plan 1. Actual template implementation
 * and static asset serving will be added in Plan 2+ migration tasks.
 *
 * Plan 2 will use this module to render HTML templates for:
 * - airline-app frontend
 * - email-app frontend
 * - browser-portal pages
 */

import type { Context } from "hono";

/**
 * Register static asset serving middleware on a Hono app.
 * Stub — Plan 2 implements the actual static file serving.
 */
export function registerStaticAssets(_options?: {
  /** Directory containing static assets */
  dir?: string;
  /** URL prefix for static assets */
  prefix?: string;
}): void {
  throw new Error("registerStaticAssets not yet implemented (Plan 2)");
}

/**
 * Render a TSX template to an HTML response.
 * Stub — Plan 2 implements actual TSX rendering.
 */
export function renderTemplate(
  _c: Context,
  _template: string,
  _data?: Record<string, unknown>,
): Response {
  throw new Error("renderTemplate not yet implemented (Plan 2)");
}

/**
 * Template data type for render functions.
 * Each mock defines its own template data shape.
 */
export interface TemplateData {
  [key: string]: unknown;
}
