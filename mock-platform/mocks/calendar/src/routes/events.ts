import { z } from "zod";
import { createRoute, ErrorResponseSchema } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";

const EventSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  title: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  source: z.string().nullable(),
  source_ref: z.string().nullable(),
  created_at: z.string(),
});

const CreateEventSchema = z.object({
  user_id: z.number(),
  title: z.string().min(1),
  start_time: z.string(),
  end_time: z.string(),
  source: z.string().optional(),
  source_ref: z.string().optional(),
});

export function registerEventsRoutes(app: OpenAPIApp, db: Database): void {
  // GET /api/events
  const listRoute = createRoute({
    method: "get",
    path: "/api/events",
    summary: "List calendar events",
    request: {
      query: z.object({
        user_id: z.string().regex(/^\d+$/).optional(),
      }),
    },
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

  app.openApiRoute(listRoute, (c): any => {
    const userIdParam = c.req.query("user_id");
    let sql = "SELECT * FROM calendar_event";
    const params: (string | number)[] = [];
    if (userIdParam) {
      sql += " WHERE user_id = ?";
      params.push(Number(userIdParam));
    }
    sql += " ORDER BY start_time ASC";
    const rows = params.length > 0 ? db.query(sql).all(...params) : db.query(sql).all();
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

  app.openApiRoute(createRouteDef, async (c): Promise<any> => {
    const body = await c.req.json();
    const parse = CreateEventSchema.safeParse(body);
    if (!parse.success) {
      return c.json({ error: "invalid_request", details: parse.error.format() }, 400);
    }

    const { user_id, title, start_time, end_time, source, source_ref } = parse.data;

    const startUtc = new Date(start_time).toISOString();
    const endUtc = new Date(end_time).toISOString();

    if (new Date(startUtc) >= new Date(endUtc)) {
      return c.json({ error: "invalid_time_range" }, 400);
    }

    // Overlap check: start_time < new_end AND end_time > new_start (normalized to UTC)
    const overlap = db
      .query<{ count: number }, [number, string, string]>(
        `SELECT COUNT(*) as count FROM calendar_event
         WHERE user_id = ? AND start_time < ? AND end_time > ?`,
      )
      .get(user_id, endUtc, startUtc);

    if (overlap && overlap.count > 0) {
      return c.json({ error: "time_overlap" }, 409);
    }

    const result = db.run(
      `INSERT INTO calendar_event (user_id, title, start_time, end_time, source, source_ref)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, title, startUtc, endUtc, source ?? null, source_ref ?? null],
    );

    const event = db
      .query("SELECT * FROM calendar_event WHERE id = ?")
      .get(result.lastInsertRowid);

    return c.json(event, 201);
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
    const id = Number(c.req.param("id"));
    const event = db.query("SELECT * FROM calendar_event WHERE id = ?").get(id);
    if (!event) {
      return c.json({ error: "not_found" }, 404);
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
    const id = Number(c.req.param("id"));
    const result = db.run("DELETE FROM calendar_event WHERE id = ?", [id]);
    if (result.changes === 0) {
      return c.json({ error: "not_found" }, 404);
    }
    return new Response(null, { status: 204 });
  });
}
