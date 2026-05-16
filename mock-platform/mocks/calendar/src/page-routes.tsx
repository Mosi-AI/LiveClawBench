/** @jsxImportSource hono/jsx */
import bcryptjs from "bcryptjs";
import { sign, tokenCookieOptions, serializeCookie, authRequired } from "mock-lib";
import type { AppEnv } from "mock-lib";
import type { Database } from "bun:sqlite";
import { CalendarPage } from "./pages/calendar-page";
import { EditEventPage } from "./pages/edit-event-page";
import { LoginPage } from "./pages/login-page";
import type { Hono } from "hono";
import { updateEvent } from "./routes/events";

interface CalEvent {
  id: number;
  title: string;
  description: string | null;
  event_type: string;
  start_time: string;
  end_time: string;
}

function getCurrentUser(
  db: Database,
  userId: number,
) {
  return (
    db
      .query<
        { id: number; first_name: string; last_name: string },
        [number]
      >("SELECT id, first_name, last_name FROM users WHERE id = ?")
      .get(userId) ?? null
  );
}

function listEvents(db: Database, userId: number) {
  return db
    .query<CalEvent, [number]>(
      "SELECT id, title, description, event_type, start_time, end_time FROM calendar_event WHERE user_id = ? ORDER BY start_time ASC",
    )
    .all(userId);
}

function getEvent(db: Database, userId: number, eventId: number) {
  return db
    .query<CalEvent, [number, number]>(
      "SELECT id, title, description, event_type, start_time, end_time FROM calendar_event WHERE id = ? AND user_id = ?",
    )
    .get(eventId, userId);
}

export function registerPageRoutes(app: Hono<AppEnv>, db: Database): void {
  const pageAuth = authRequired({ onUnauthorized: "redirect" });

  // --- Login routes (no auth) ---

  app.get("/login", (c) => {
    return c.html(<LoginPage />);
  });

  app.post("/login", async (c) => {
    let body: Record<string, string | File>;
    try {
      body = await c.req.parseBody();
    } catch {
      return c.html(<LoginPage error="Invalid form submission" />, 400);
    }
    const email = String(body.email ?? "");
    const password = String(body.password ?? "");

    const user = db
      .query<
        {
          id: number;
          password_hash: string;
          first_name: string;
          last_name: string;
        },
        [string]
      >(
        "SELECT id, password_hash, first_name, last_name FROM users WHERE email = ?",
      )
      .get(email);

    if (!user || !bcryptjs.compareSync(password, user.password_hash)) {
      return c.html(<LoginPage error="Invalid email or password" />);
    }

    const token = await sign({ userId: user.id });
    c.header("Set-Cookie", serializeCookie("token", token, tokenCookieOptions()));
    return c.redirect("/");
  });

  // --- Protected page routes ---

  app.get("/", pageAuth, (c) => {
    const userId = c.get("userId")!;
    const user = getCurrentUser(db, userId);
    if (!user) return c.redirect("/login");
    const events = listEvents(db, userId);
    return c.html(<CalendarPage user={user} events={events} />);
  });

  app.post("/events", pageAuth, async (c) => {
    const userId = c.get("userId")!;
    const user = getCurrentUser(db, userId);
    if (!user) return c.redirect("/login");

    let body: Record<string, string | File>;
    try {
      body = await c.req.parseBody();
    } catch {
      const events = listEvents(db, userId);
      return c.html(
        <CalendarPage user={user} events={events} error="Invalid form submission" />,
        400,
      );
    }
    const title = String(body.title ?? "");
    const description = String(body.description ?? "");
    const eventType = String(body.event_type ?? "personal");
    const startTime = String(body.start_time ?? "");
    const endTime = String(body.end_time ?? "");

    if (!title || !startTime || !endTime) {
      const events = listEvents(db, userId);
      return c.html(
        <CalendarPage user={user} events={events} error="All fields are required" />,
      );
    }

    const startUtc = new Date(startTime).toISOString();
    const endUtc = new Date(endTime).toISOString();

    if (new Date(startUtc) >= new Date(endUtc)) {
      const events = listEvents(db, userId);
      return c.html(
        <CalendarPage
          user={user}
          events={events}
          error="End time must be after start time"
        />,
      );
    }

    const overlap = db
      .query<{ count: number }, [number, string, string]>(
        "SELECT COUNT(*) as count FROM calendar_event WHERE user_id = ? AND start_time < ? AND end_time > ?",
      )
      .get(userId, endUtc, startUtc);

    if (overlap && overlap.count > 0) {
      const events = listEvents(db, userId);
      return c.html(
        <CalendarPage
          user={user}
          events={events}
          error="Time overlaps with an existing event"
        />,
      );
    }

    db.run(
      "INSERT INTO calendar_event (user_id, title, description, event_type, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)",
      [userId, title, description || null, eventType, startUtc, endUtc],
    );

    return c.redirect("/");
  });

  // Edit form page (GET)
  app.get("/events/:id/edit", pageAuth, (c) => {
    const userId = c.get("userId")!;
    const user = getCurrentUser(db, userId);
    if (!user) return c.redirect("/login");
    const id = Number(c.req.param("id"));
    const event = getEvent(db, userId, id);
    if (!event) {
      const events = listEvents(db, userId);
      return c.html(
        <CalendarPage user={user} events={events} error="Event not found" />,
      );
    }
    return c.html(<EditEventPage user={user} event={event} />);
  });

  // Edit form submission (POST bridge — delegates to shared update logic)
  app.post("/events/:id/edit", pageAuth, async (c) => {
    const userId = c.get("userId")!;
    const user = getCurrentUser(db, userId);
    if (!user) return c.redirect("/login");
    const id = Number(c.req.param("id"));

    let body: Record<string, string | File>;
    try {
      body = await c.req.parseBody();
    } catch {
      const event = getEvent(db, userId, id);
      return c.html(
        <EditEventPage user={user} event={event!} error="Invalid form submission" />,
        400,
      );
    }

    const title = String(body.title ?? "");
    const startTime = String(body.start_time ?? "");
    const endTime = String(body.end_time ?? "");

    if (!title || !startTime || !endTime) {
      const event = getEvent(db, userId, id);
      return c.html(
        <EditEventPage user={user} event={event!} error="All fields are required" />,
      );
    }

    const eventType = String(body.event_type ?? "personal");
    const description = String(body.description ?? "");

    const updateData: Record<string, unknown> = {
      title,
      description: description || null,
      event_type: eventType,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
    };

    const result = updateEvent(db, userId, id, updateData);
    if (!result.ok) {
      const event = getEvent(db, userId, id);
      const errorMessages: Record<string, string> = {
        not_found: "Event not found",
        invalid_time_range: "End time must be after start time",
        time_overlap: "Time overlaps with another event",
      };
      return c.html(
        <EditEventPage user={user} event={event!} error={errorMessages[result.error] ?? result.error} />,
      );
    }

    return c.redirect("/");
  });

  app.post("/events/:id/delete", pageAuth, (c) => {
    const userId = c.get("userId")!;
    const id = Number(c.req.param("id"));
    db.run("DELETE FROM calendar_event WHERE id = ? AND user_id = ?", [id, userId]);
    return c.redirect("/");
  });
}
