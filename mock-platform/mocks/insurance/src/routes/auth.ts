import { z } from "zod";
import bcryptjs from "bcryptjs";
import { createRoute, sign, tokenCookieOptions, serializeCookie, BCRYPT_SALT_ROUNDS, err } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { ErrorResponseSchema } from "mock-lib";
import type { UserRow, SafeUser } from "../types";

const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RegisterBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
});

const UserSchema = z.object({
  id: z.number(),
  email: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().nullable(),
});

const AuthSuccessSchema = z.object({
  token: z.string(),
  user: UserSchema,
});

export function getUserByEmail(
  db: Database,
  email: string,
): UserRow | null {
  return db
    .query<UserRow, [string]>(
      "SELECT id, email, password_hash, first_name, last_name, phone FROM users WHERE email = ?",
    )
    .get(email);
}

function getUserById(
  db: Database,
  id: number,
): UserRow | null {
  return db
    .query<UserRow, [number]>(
      "SELECT id, email, password_hash, first_name, last_name, phone FROM users WHERE id = ?",
    )
    .get(id);
}

function toSafeUser(user: UserRow): SafeUser {
  const { password_hash: _, ...safeUser } = user;
  return safeUser;
}

export function registerAuthRoutes(app: OpenAPIApp, db: Database): void {
  // POST /api/auth/login
  const loginRoute = createRoute({
    method: "post",
    path: "/api/auth/login",
    summary: "Login with email and password",
    request: {
      body: {
        content: {
          "application/json": {
            schema: LoginBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: AuthSuccessSchema,
          },
        },
        description: "Login successful",
      },
      401: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Invalid credentials",
      },
    },
  });

  app.openApiRoute(loginRoute, async (c): Promise<any> => {
    const { email, password } = c.req.valid("json");
    const user = getUserByEmail(db, email);
    if (!user || !bcryptjs.compareSync(password, user.password_hash)) {
      return c.json(err("Invalid email or password"), 401);
    }

    const token = await sign({ userId: user.id });
    const cookieStr = serializeCookie("token", token, tokenCookieOptions());
    c.header("Set-Cookie", cookieStr);

    return c.json({ token, user: toSafeUser(user) });
  });

  // POST /api/auth/register
  const registerRoute = createRoute({
    method: "post",
    path: "/api/auth/register",
    summary: "Register a new user",
    request: {
      body: {
        content: {
          "application/json": {
            schema: RegisterBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: AuthSuccessSchema,
          },
        },
        description: "Registration successful",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Email already registered or invalid input",
      },
    },
  });

  app.openApiRoute(registerRoute, async (c): Promise<any> => {
    const { email, password, first_name, last_name } = c.req.valid("json");

    const existing = getUserByEmail(db, email);
    if (existing) {
      return c.json(err("Email already registered"), 400);
    }

    const passwordHash = bcryptjs.hashSync(password, BCRYPT_SALT_ROUNDS);
    const insertResult = db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES (?, ?, ?, ?)`,
    ).run(email, passwordHash, first_name, last_name);

    const userId = Number(insertResult.lastInsertRowid);
    const newUser = getUserById(db, userId);
    if (!newUser) {
      return c.json(err("Failed to create user"), 500);
    }

    const token = await sign({ userId: newUser.id });
    const cookieStr = serializeCookie("token", token, tokenCookieOptions());
    c.header("Set-Cookie", cookieStr);

    const { password_hash: _, ...safeUser } = newUser;
    return c.json({ token, user: toSafeUser(newUser) }, 201);
  });

  // GET /api/auth/me
  const meRoute = createRoute({
    method: "get",
    path: "/api/auth/me",
    summary: "Get current authenticated user",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: UserSchema,
          },
        },
        description: "Current user",
      },
    },
  });

  app.openApiRoute(meRoute, (c): any => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json(err("Unauthorized"), 401);
    }
    const user = getUserById(db, userId);
    if (!user) {
      return c.json(err("User not found"), 404);
    }
    return c.json(toSafeUser(user));
  }, { auth: "required" });
}
