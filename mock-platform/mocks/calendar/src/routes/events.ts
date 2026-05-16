import { z } from "zod";
import { createRoute, ErrorResponseSchema, authRequired, err } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";

const EVENT_TYPE_VALUES = ["personal", "medication", "appointment", "content"] as const;

const EventSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  event_type: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  source: z.string().nullable(),
  source_ref: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const CreateEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  event_type: z.enum(EVENT_TYPE_VALUES).default("personal"),
  start_time: z.string(),
  end_time: z.string(),
  source: z.string().optional(),
  source_ref: z.string().optional(),
});

const UpdateEventBodySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  event_type: z.enum(EVENT_TYPE_VALUES).optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  source: z.string().nullable().optional(),
  source_ref: z.string().nullable().optional(),
});

export function registerEventsRoutes(app: OpenAPIApp, db: Database): void {
  // All API routes require authentication
  app.use("/api/*", authRequired);

  // GET /api/events
  const listRoute = createRoute({
    method: "get",
    path: "/api/events",
    summary: "List calendar events for the authenticated user",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ events: z.array(EventSchema) }),
          },
        },
        description: "List of events",
      },
    },
  });

  app.openApiRoute(listRoute, (c) => {
    const userId = c.get("userId")!;
    const rows = db
      .query("SELECT * FROM calendar_event WHERE user_id = ? ORDER BY start_time ASC")
      .all(userId);
    return c.json({ events: rows });
  });

  // POST /api/events
  const createRouteDef = createRoute({
    method: "post",
    path: "/api/events",
    summary: "Create a calendar event",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateEventSchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: EventSchema,
          },
        },
        description: "Event created",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Time overlap conflict",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Invalid request",
      },
    },
  });

  app.openApiRoute(createRouteDef, async (c) => {
    const userId = c.get("userId")!;
    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json(err("invalid_request: Malformed JSON"), 400);
    }

    const parse = CreateEventSchema.safeParse(body);
    if (!parse.success) {
      const issues = parse.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return c.json(err(`invalid_request: ${issues}`), 400);
    }

    const { title, description, event_type, start_time, end_time, source, source_ref } = parse.data;

    const startUtc = new Date(start_time).toISOString();
    const endUtc = new Date(end_time).toISOString();

    if (new Date(startUtc) >= new Date(endUtc)) {
      return c.json(err("invalid_time_range"), 400);
    }

    db.run("BEGIN IMMEDIATE");
    try {
      const overlap = db
        .query<{ count: number }, [number, string, string]>(
          `SELECT COUNT(*) as count FROM calendar_event
           WHERE user_id = ? AND start_time < ? AND end_time > ?`,
        )
        .get(userId, endUtc, startUtc);

      if (overlap && overlap.count > 0) {
        db.run("ROLLBACK");
        return c.json(err("time_overlap"), 409);
      }

      const result = db.run(
        `INSERT INTO calendar_event (user_id, title, description, event_type, start_time, end_time, source, source_ref)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, title, description ?? null, event_type, startUtc, endUtc, source ?? null, source_ref ?? null],
      );

      const event = db
        .query("SELECT * FROM calendar_event WHERE id = ? AND user_id = ?")
        .get(result.lastInsertRowid, userId);
      db.run("COMMIT");
      return c.json(event, 201);
    } catch (e) {
      db.run("ROLLBACK");
      throw e;
    }
  });

  // GET /api/events/:id
  const getRoute = createRoute({
    method: "get",
    path: "/api/events/{id}",
    summary: "Get a single event",
    request: {
      params: z.object({ id: z.string().regex(/^\d+$/) }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: EventSchema,
          },
        },
        description: "Event found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Event not found",
      },
    },
  });

  app.openApiRoute(getRoute, (c) => {
    const userId = c.get("userId")!;
    const id = Number(c.req.param("id"));
    const event = db.query("SELECT * FROM calendar_event WHERE id = ? AND user_id = ?").get(id, userId);
    if (!event) {
      return c.json(err("not_found"), 404);
    }
    return c.json(event);
  });

  // DELETE /api/events/:id
  const deleteRoute = createRoute({
    method: "delete",
    path: "/api/events/{id}",
    summary: "Delete a calendar event",
    request: {
      params: z.object({ id: z.string().regex(/^\d+$/) }),
    },
    responses: {
      204: {
        description: "Event deleted",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Event not found",
      },
    },
  });

  app.openApiRoute(deleteRoute, (c) => {
    const userId = c.get("userId")!;
    const id = Number(c.req.param("id"));
    const result = db.run("DELETE FROM calendar_event WHERE id = ? AND user_id = ?", [id, userId]);
    if (result.changes === 0) {
      return c.json(err("not_found"), 404);
    }
    return new Response(null, { status: 204 });
  });

  // PUT /api/events/:id
  const updateRoute = createRoute({
    method: "put",
    path: "/api/events/{id}",
    summary: "Update a calendar event",
    request: {
      params: z.object({ id: z.string().regex(/^\d+$/) }),
      body: {
        content: {
          "application/json": {
            schema: UpdateEventBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: EventSchema,
          },
        },
        description: "Event updated",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Invalid request",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Event not found",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Time overlap conflict",
      },
    },
  });

  app.openApiRoute(updateRoute, async (c) => {
    const userId = c.get("userId")!;
    const id = Number(c.req.param("id"));

    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json(err("invalid_request: Malformed JSON"), 400);
    }

    const parse = UpdateEventBodySchema.safeParse(body);
    if (!parse.success) {
      const issues = parse.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return c.json(err(`invalid_request: ${issues}`), 400);
    }

    const data = parse.data;

    const existing = db.query("SELECT * FROM calendar_event WHERE id = ? AND user_id = ?").get(id, userId) as Record<string, unknown> | null;
    if (!existing) {
      return c.json(err("not_found"), 404);
    }

    // If no fields to update, return existing
    if (Object.keys(data).length === 0) {
      return c.json(existing);
    }

    const validFields = ["title", "description", "event_type", "start_time", "end_time", "source", "source_ref"] as const;
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    for (const field of validFields) {
      if (field in data) {
        const val = data[field as keyof typeof data];
        updates.push(`${field} = ?`);
        values.push(val === undefined ? null : val === null ? null : String(val));
      }
    }

    if (updates.length === 0) {
      return c.json(existing);
    }

    // Check for time overlap if start_time or end_time changed
    const newStart = data.start_time !== undefined ? new Date(data.start_time).toISOString() : String(existing.start_time);
    const newEnd = data.end_time !== undefined ? new Date(data.end_time).toISOString() : String(existing.end_time);

    if (new Date(newStart) >= new Date(newEnd)) {
      return c.json(err("invalid_time_range"), 400);
    }

    db.run("BEGIN IMMEDIATE");
    try {
      // Overlap check excluding self
      const overlap = db
        .query<{ count: number }, [number, string, string, number]>(
          `SELECT COUNT(*) as count FROM calendar_event
           WHERE user_id = ? AND start_time < ? AND end_time > ? AND id != ?`,
        )
        .get(userId, newEnd, newStart, id);

      if (overlap && overlap.count > 0) {
        db.run("ROLLBACK");
        return c.json(err("time_overlap"), 409);
      }

      updates.push("updated_at = datetime('now')");
      db.query(`UPDATE calendar_event SET ${updates.join(", ")} WHERE id = ?`).run(...values, id);

      const updated = db.query("SELECT * FROM calendar_event WHERE id = ? AND user_id = ?").get(id, userId);
      db.run("COMMIT");
      return c.json(updated);
    } catch (e) {
      db.run("ROLLBACK");
      throw e;
    }
  });
}
