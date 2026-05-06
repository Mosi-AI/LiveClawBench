/**
 * Doc-search Zod schemas
 *
 * Doc-search currently serves HTML pages only (no JSON API routes).
 * This file contains the sentinel response schema and will expand
 * if JSON API routes are added in the future.
 */

import { z } from "zod";

export const SentinelResponseSchema = z.object({
  ok: z.boolean(),
});
