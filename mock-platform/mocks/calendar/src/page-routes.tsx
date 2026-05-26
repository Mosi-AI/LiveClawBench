/** @jsxImportSource hono/jsx */
import bcryptjs from "bcryptjs";
import { sign, tokenCookieOptions, serializeCookie, authRequired, shouldInject } from "mock-lib";
import type { AppEnv } from "mock-lib";
import type { Database } from "bun:sqlite";
import { CalendarPage } from "./pages/calendar-page";
import { EditEventPage } from "./pages/edit-event-page";
import { LoginPage } from "./pages/login-page";
import type { Hono } from "hono";
import { createEvent, updateEvent } from "./routes/events";

interface CalEvent {
  id: number;
  title: string;
  description: string | null;
  event_type: string;
  start_time: string;
  end_time: string;
  source_ref: string | null;
}

function formatEventError(error: string): string {
  const messages: Record<string, string> = {
    not_found: "Event not found",
    invalid_time_range: "End time must be after start time",
    time_overlap: "Time overlaps with an existing event",
  };
  return error.startsWith("invalid_request:")
    ? "Invalid field value (event_type or date format)"
    : (messages[error] ?? error);
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
      "SELECT id, title, description, event_type, start_time, end_time, source_ref FROM calendar_event WHERE user_id = ? ORDER BY start_time ASC",
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

    // createEvent() validates event_type through CreateEventSchema and parses
    // start_time/end_time internally, so crafted form data (e.g. event_type=bad)
    // or malformed dates are rejected before any database mutation.

    const taskName = process.env.TASK_NAME ?? "";

    // C1 — meeting-slot-race: inject a blocking event before the main create.
    // Uses the authenticated user's ID so the overlap query (filtered by
    // user_id) detects the conflict.
    if (
      taskName === "meeting-slot-race" &&
      shouldInject(taskName, "calendar", "POST /api/events", "c1-slot-race")
    ) {
      try {
        const blockStart = new Date(startTime).toISOString();
        const blockEnd = new Date(endTime).toISOString();
        db.run(
          `INSERT INTO calendar_event (user_id, title, start_time, end_time, description, event_type)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, "Team Standup", blockStart, blockEnd, "Auto-scheduled team meeting", "personal"],
        );
      } catch {
        // Unparseable dates — skip injection; normal validation will catch.
      }
    }

    // C2 — interview-slot-verify: shift times by +1 hour in DB.
    let pageCreateOptions: { shiftedTimes?: { startUtc: string; endUtc: string } } = {};
    if (
      taskName === "interview-slot-verify" &&
      shouldInject(taskName, "calendar", "POST /api/events", "c2-wrong-time")
    ) {
      try {
        const shiftedStart = new Date(new Date(startTime).getTime() + 3600_000).toISOString();
        const shiftedEnd = new Date(new Date(endTime).getTime() + 3600_000).toISOString();
        pageCreateOptions = { shiftedTimes: { startUtc: shiftedStart, endUtc: shiftedEnd } };
      } catch {
        // Unparseable dates — skip injection; normal validation will catch.
      }
    }

    const result = createEvent(db, userId, {
      title,
      description: description || undefined,
      event_type: eventType,
      start_time: startTime,
      end_time: endTime,
    }, pageCreateOptions);
    if (!result.ok) {
      const events = listEvents(db, userId);
      return c.html(
        <CalendarPage user={user} events={events} error={formatEventError(result.error)} />,
      );
    }

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
      if (!event) {
        const events = listEvents(db, userId);
        return c.html(
          <CalendarPage user={user} events={events} error="Event not found" />,
        );
      }
      return c.html(
        <EditEventPage user={user} event={event} error="Invalid form submission" />,
        400,
      );
    }

    const title = String(body.title ?? "");
    const startTime = String(body.start_time ?? "");
    const endTime = String(body.end_time ?? "");

    if (!title || !startTime || !endTime) {
      const event = getEvent(db, userId, id);
      if (!event) {
        const events = listEvents(db, userId);
        return c.html(
          <CalendarPage user={user} events={events} error="Event not found" />,
        );
      }
      return c.html(
        <EditEventPage user={user} event={event} error="All fields are required" />,
      );
    }

    const eventType = String(body.event_type ?? "personal");
    const description = String(body.description ?? "");

    // Pass raw start_time/end_time strings to updateEvent so the helper's
    // try/catch returns "invalid_request: ..." on malformed dates instead of
    // letting RangeError escape from new Date(...).toISOString() here.
    const updateData: Record<string, unknown> = {
      title,
      description: description || null,
      event_type: eventType,
      start_time: startTime,
      end_time: endTime,
    };

    const result = updateEvent(db, userId, id, updateData);
    if (!result.ok) {
      const event = getEvent(db, userId, id);
      if (!event) {
        const events = listEvents(db, userId);
        return c.html(
          <CalendarPage user={user} events={events} error="Event not found" />,
        );
      }
      return c.html(
        <EditEventPage user={user} event={event} error={formatEventError(result.error)} />,
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
