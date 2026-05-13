import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { ok, err } from "mock-lib";
import { getUserById, DEFAULT_USER_ID } from "../helpers";
import {
  OkSchema,
  ErrSchema,
  UserSchema,
  ProfileUpdateBodySchema,
} from "../schemas";

export function registerProfileRoutes(app: OpenAPIApp, db: Database): void {
  const profileResponse = OkSchema(UserSchema);

  // GET /api/profile
  const getRoute = createRoute({
    method: "get",
    path: "/api/profile",
    summary: "Get user profile",
    responses: {
      200: {
        content: { "application/json": { schema: profileResponse } },
        description: "OK",
      },
      404: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(getRoute, (c) => {
    const user = getUserById(db, DEFAULT_USER_ID);
    if (!user) return c.json(err("User not found"), 404);
    return c.json(ok(user));
  });

  // PUT /api/profile
  const updateRoute = createRoute({
    method: "put",
    path: "/api/profile",
    summary: "Update user profile",
    request: {
      body: {
        content: { "application/json": { schema: ProfileUpdateBodySchema } },
        description: "Profile updates",
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: profileResponse } },
        description: "OK",
      },
      400: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Bad request",
      },
    },
  });

  app.openApiRoute(updateRoute, async (c) => {
    const data = c.req.valid("json");
    const fields: string[] = [];
    const values: (string | null)[] = [];

    if (data.first_name !== undefined) { fields.push("first_name = ?"); values.push(String(data.first_name)); }
    if (data.last_name !== undefined) { fields.push("last_name = ?"); values.push(String(data.last_name)); }
    if (data.phone !== undefined) { fields.push("phone = ?"); values.push(data.phone ? String(data.phone) : null); }
    if (data.email !== undefined) { fields.push("email = ?"); values.push(String(data.email)); }

    if (fields.length === 0) {
      return c.json(err("No fields to update"), 400);
    }

    db.query(`UPDATE users SET ${fields.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...values, DEFAULT_USER_ID);
    const user = getUserById(db, DEFAULT_USER_ID);
    return c.json(ok(user, "Profile updated"));
  });
}
