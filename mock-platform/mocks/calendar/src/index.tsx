/** @jsxImportSource hono/jsx */
import { z } from "zod";
import bcryptjs from "bcryptjs";
import { createMockApp, createRoute, registerStaticAssets, startServer } from "mock-lib";
import type { MockAppV2 } from "mock-lib";
import type { Database } from "bun:sqlite";
import { getCalendarDb, initSchema } from "./db";
import { seedDatabase } from "./seed";
import { registerEventsRoutes } from "./routes/events";
import { CalendarPage } from "./pages/calendar-page";
import { LoginPage } from "./pages/login-page";

export function createCalendarApp(): MockAppV2 {
  const mockApp = createMockApp({
    name: "calendar",
    port: 5003,
    openApi: {
      enabled: true,
      title: "Calendar Mock API",
      version: "1.0.0",
    },
  });

  const db = getCalendarDb();
  initSchema(db);
  seedDatabase(db);

  // Sentinel route for isolation verification.
  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/calendar",
    summary: "Binary isolation probe",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              ok: z.boolean(),
              mock: z.string(),
            }),
          },
        },
        description: "OK",
      },
    },
  });

  mockApp.app.openApiRoute(sentinelRoute, (c) => c.json({ ok: true, mock: "calendar" }));

  registerEventsRoutes(mockApp.app, db);
  registerStaticAssets(mockApp.app, { dir: "/opt/mock/static/calendar", prefix: "/static" });
  registerPageRoutes(mockApp.app, db);

  return {
    ...mockApp,
    seed: () => seedDatabase(db),
  };
}

function getUserFromCookie(db: Database, c: any): { id: number; first_name: string; last_name: string } | null {
  // Simple cookie-based session check
  const cookieHeader = c.req.header("cookie") || "";
  const match = cookieHeader.match(/calendar_token=([^;]+)/);
  if (!match) return null;
  try {
    const parts = (match[1] || "").split(".");
    if (parts.length < 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.userId) return null;
    const user = db
      .query<{ id: number; first_name: string; last_name: string }, [number]>(
        "SELECT id, first_name, last_name FROM users WHERE id = ?",
      )
      .get(payload.userId);
    return user ?? null;
  } catch {
    return null;
  }
}

interface CalEvent { id: number; title: string; start_time: string; end_time: string; }

const listEventsStmt = (db: Database) =>
  db.query<CalEvent, [number]>("SELECT id, title, start_time, end_time FROM calendar_event WHERE user_id = ? ORDER BY start_time ASC");

function registerPageRoutes(app: any, db: Database): void {
  // GET / — Calendar portal home
  app.get("/", async (c: any) => {
    const user = getUserFromCookie(db, c);
    if (!user) {
      return c.redirect("/login");
    }
    const events = listEventsStmt(db).all(user.id);
    return c.html(<CalendarPage user={user} events={events} />);
  });

  // GET /login — Login page
  app.get("/login", async (c: any) => {
    return c.html(<LoginPage />);
  });

  // POST /login — Login form handler
  app.post("/login", async (c: any) => {
    const body = await c.req.parseBody();
    const email = String(body.email || "");
    const password = String(body.password || "");

    const user = db
      .query<{ id: number; email: string; password_hash: string; first_name: string; last_name: string }, [string]>(
        "SELECT id, email, password_hash, first_name, last_name FROM users WHERE email = ?",
      )
      .get(email);

    if (!user || !bcryptjs.compareSync(password, user.password_hash)) {
      return c.html(<LoginPage error="Invalid email or password" />);
    }

    // Simple JWT-like token
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({ userId: user.id, exp: Date.now() + 86400000 }));
    const token = `${header}.${payload}.sig`;

    c.header("Set-Cookie", `calendar_token=${token}; HttpOnly; SameSite=Lax; Max-Age=86400; Path=/`);
    return c.redirect("/");
  });

  // POST /events — Create event from form
  app.post("/events", async (c: any) => {
    const user = getUserFromCookie(db, c);
    if (!user) return c.redirect("/login");

    const body = await c.req.parseBody();
    const title = String(body.title || "");
    const startTime = String(body.start_time || "");
    const endTime = String(body.end_time || "");

    if (!title || !startTime || !endTime) {
      const events = listEventsStmt(db).all(user.id);
      return c.html(<CalendarPage user={user} events={events} error="All fields are required" />);
    }

    // Convert datetime-local to ISO
    const startUtc = new Date(startTime).toISOString();
    const endUtc = new Date(endTime).toISOString();

    if (new Date(startUtc) >= new Date(endUtc)) {
      const events = listEventsStmt(db).all(user.id);
      return c.html(<CalendarPage user={user} events={events} error="End time must be after start time" />);
    }

    // Overlap check
    const overlap = db
      .query<{ count: number }, [number, string, string]>(
        "SELECT COUNT(*) as count FROM calendar_event WHERE user_id = ? AND start_time < ? AND end_time > ?",
      )
      .get(user.id, endUtc, startUtc);

    if (overlap && overlap.count > 0) {
      const events = listEventsStmt(db).all(user.id);
      return c.html(<CalendarPage user={user} events={events} error="Time overlaps with an existing event" />);
    }

    db.run(
      "INSERT INTO calendar_event (user_id, title, start_time, end_time) VALUES (?, ?, ?, ?)",
      [user.id, title, startUtc, endUtc],
    );

    return c.redirect("/");
  });

  // POST /events/:id/delete — Delete event from form
  app.post("/events/:id/delete", async (c: any) => {
    const user = getUserFromCookie(db, c);
    if (!user) return c.redirect("/login");

    const id = Number(c.req.param("id"));
    db.run("DELETE FROM calendar_event WHERE id = ? AND user_id = ?", [id, user.id]);
    return c.redirect("/");
  });
}

if (import.meta.main) {
  const app = createCalendarApp();
  startServer(app);
}
