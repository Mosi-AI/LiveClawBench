import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { sign } from "mock-lib";
import { ok, err, getUserById, verifyWerkzeugHash } from "../helpers";

export function registerAuthRoutes(app: OpenAPIApp, db: Database): void {
  // POST /api/auth/register
  app.post("/api/auth/register", async (c) => {
    const body = (await c.req.json()) as Record<string, unknown>;
    const username = String(body.username ?? "");
    const email = String(body.email ?? "");
    const password = String(body.password ?? "");

    if (!username || !email || !password) {
      return c.json(err("Missing required fields"), 400);
    }
    if (password.length < 6) {
      return c.json(err("Password must be at least 6 characters"), 400);
    }

    const existingUsername = db.query("SELECT id FROM users WHERE username = ?").get(username) as { id: number } | null;
    if (existingUsername) {
      return c.json(err("Username already exists"), 400);
    }
    const existingEmail = db.query("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | null;
    if (existingEmail) {
      return c.json(err("Email already registered"), 400);
    }

    // Store plaintext password for simplicity (Bun mock, not production)
    db.query(
      "INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, datetime('now'))"
    ).run(username, email, password);

    const row = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
    const user = getUserById(db, row.id);
    const accessToken = await sign({ userId: row.id });

    return c.json(ok({ user, access_token: accessToken }, "User registered successfully"), 201);
  });

  // POST /api/auth/login
  app.post("/api/auth/login", async (c) => {
    const body = (await c.req.json()) as Record<string, unknown>;
    const username = String(body.username ?? "");
    const password = String(body.password ?? "");

    if (!username || !password) {
      return c.json(err("Missing credentials"), 400);
    }

    const row = db.query("SELECT id, password_hash FROM users WHERE username = ?").get(username) as
      | { id: number; password_hash: string }
      | null;
    if (!row) {
      return c.json(err("Invalid username or password"), 401);
    }

    // Try Werkzeug hash first, then plaintext fallback
    let valid = false;
    if (row.password_hash.startsWith("pbkdf2:")) {
      valid = await verifyWerkzeugHash(row.password_hash, password);
    } else {
      valid = row.password_hash === password;
    }

    if (!valid) {
      return c.json(err("Invalid username or password"), 401);
    }

    const user = getUserById(db, row.id);
    const accessToken = await sign({ userId: row.id });

    return c.json(ok({ user, access_token: accessToken }, "Login successful"));
  });

  // GET /api/auth/me
  app.get("/api/auth/me", async (c) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json(err("Authentication required"), 401);
    }

    const token = authHeader.slice(7);
    const { verify } = await import("mock-lib");
    const payload = await verify(token);
    if (!payload?.userId) {
      return c.json(err("Invalid or expired token"), 401);
    }

    const user = getUserById(db, payload.userId as number);
    if (!user) {
      return c.json(err("User not found"), 404);
    }

    return c.json(ok({ user }));
  });
}
