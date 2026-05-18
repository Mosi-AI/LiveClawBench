import { z } from "zod";
import { createRoute, ok, err } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import {
  UserDataSchema,
  OkSchema,
  UpdateUserBodySchema,
  GenericSuccessResponseSchema,
  ErrSchema,
} from "../schemas.js";
import { loadUser, saveUser } from "../data/store.js";

export function registerUserRoutes(app: OpenAPIApp) {
  // GET /api/user
  const getUserRoute = createRoute({
    method: "get",
    path: "/api/user",
    summary: "Get user profile",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OkSchema(UserDataSchema),
          },
        },
        description: "OK",
      },
    },
  });

  app.openApiRoute(getUserRoute, (c) => {
    return c.json(ok(loadUser()));
  });

  // POST /api/user/update
  const updateUserRoute = createRoute({
    method: "post",
    path: "/api/user/update",
    summary: "Update user profile",
    request: {
      body: {
        content: {
          "application/json": {
            schema: UpdateUserBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: GenericSuccessResponseSchema,
          },
        },
        description: "OK",
      },
      500: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Internal server error",
      },
    },
  });

  app.openApiRoute(updateUserRoute, (c) => {
    const { field, value } = c.req.valid("json");

    const user = loadUser();
    (user as unknown as Record<string, unknown>)[field] = value;
    try {
      saveUser(user);
    } catch (e) {
      console.error("mock-shop: failed to save user", e);
      return c.json(err("Failed to save user profile"), 500);
    }

    return c.json(ok(null, `${field} updated successfully`), 200);
  });
}
