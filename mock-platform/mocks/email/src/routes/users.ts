import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { ok, err, getAuthUserId } from "../helpers";
import { UserSearchResponseSchema, ErrorResponseSchema } from "../schemas";
import { z } from "zod";

export function registerUserRoutes(app: OpenAPIApp, db: Database): void {
  const searchQuerySchema = z.object({
    q: z.string().optional(),
  });

  // GET /api/users/search
  const searchRoute = createRoute({
    method: "get",
    path: "/api/users/search",
    summary: "Search users",
    request: { query: searchQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: UserSearchResponseSchema } },
        description: "OK",
      },
      401: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unauthorized",
      },
    },
  });

  app.openApiRoute(searchRoute, async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json(err("Authentication required"), 401);

    const { q } = c.req.valid("query");
    const query = (q ?? "").trim();

    if (!query) {
      return c.json(ok({ users: [] }));
    }

    const escaped = query.replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escaped}%`;
    const rows = db.query(
      `SELECT id, username, email, created_at FROM users
       WHERE username LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\'
       LIMIT 10`
    ).all(pattern, pattern) as Record<string, unknown>[];

    const users = rows.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      created_at: u.created_at,
    }));

    return c.json(ok({ users }));
  });
}
