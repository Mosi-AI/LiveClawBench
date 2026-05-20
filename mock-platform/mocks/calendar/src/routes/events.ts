import { z } from "zod";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { getAuthUserId } from "../helpers";

const EventSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  title: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  description: z.string().nullable(),
  source: z.string().nullable(),
  source_ref: z.string().nullable(),
  created_at: z.string(),
});
const ErrorResponse = z.object({ ok: z.boolean(), error: z.string() });

export function registerEventRoutes(app: OpenAPIApp, db: Database): void {
  const listRoute = createRoute({
    method: "get",
    path: "/api/events",
    summary: "List calendar events for authenticated user",
    responses: {
      200: { content: { "application/json": { schema: z.object({ ok: z.boolean(), events: z.array(EventSchema) }) } }, description: "OK" },
      401: { content: { "application/json": { schema: ErrorResponse } }, description: "Unauthorized" },
    },
  });

  app.openApiRoute(listRoute, async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json({ ok: false, error: "Authentication required" }, 401);
    const events = db
      .query("SELECT * FROM calendar_event WHERE user_id = ? ORDER BY start_time ASC")
      .all(userId) as z.infer<typeof EventSchema>[];
    return c.json({ ok: true, events });
  });

  const getRoute = createRoute({
    method: "get",
    path: "/api/events/{id}",
    summary: "Get a single calendar event",
    responses: {
      200: { content: { "application/json": { schema: EventSchema } }, description: "OK" },
      401: { content: { "application/json": { schema: ErrorResponse } }, description: "Unauthorized" },
      404: { content: { "application/json": { schema: ErrorResponse } }, description: "Not found" },
    },
  });

  app.openApiRoute(getRoute, async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json({ ok: false, error: "Authentication required" }, 401);
    const id = parseInt(c.req.param("id"), 10);
    const event = db
      .query("SELECT * FROM calendar_event WHERE id = ? AND user_id = ?")
      .get(id, userId) as z.infer<typeof EventSchema> | null;
    if (!event) return c.json({ ok: false, error: "Event not found" }, 404);
    return c.json(event);
  });

  const createRoute_ = createRoute({
    method: "post",
    path: "/api/events",
    summary: "Create a calendar event",
    responses: {
      201: { content: { "application/json": { schema: EventSchema } }, description: "Created" },
      400: { content: { "application/json": { schema: ErrorResponse } }, description: "Bad Request" },
      401: { content: { "application/json": { schema: ErrorResponse } }, description: "Unauthorized" },
      409: { content: { "application/json": { schema: ErrorResponse } }, description: "Conflict" },
    },
  });

  app.openApiRoute(createRoute_, async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json({ ok: false, error: "Authentication required" }, 401);

    let body: Record<string, unknown>;
    try { body = await c.req.json(); } catch { return c.json({ ok: false, error: "Invalid JSON body" }, 400); }

    const title = String(body.title ?? "");
    const startTime = String(body.start_time ?? "");
    const endTime = String(body.end_time ?? "");
    const description = body.description != null ? String(body.description) : null;

    if (!title || !startTime || !endTime) {
      return c.json({ ok: false, error: "title, start_time and end_time are required" }, 400);
    }

    const startUtc = new Date(startTime).toISOString();
    const endUtc = new Date(endTime).toISOString();
    if (new Date(startUtc) >= new Date(endUtc)) {
      return c.json({ ok: false, error: "end_time must be after start_time" }, 400);
    }

    const overlap = db
      .query<{ count: number }, [number, string, string]>(
        "SELECT COUNT(*) as count FROM calendar_event WHERE user_id = ? AND start_time < ? AND end_time > ?",
      )
      .get(userId, endUtc, startUtc);
    if (overlap && overlap.count > 0) {
      return c.json({ ok: false, error: "Time overlaps with an existing event" }, 409);
    }

    const result = db.run(
      "INSERT INTO calendar_event (user_id, title, start_time, end_time, description) VALUES (?, ?, ?, ?, ?)",
      [userId, title, startUtc, endUtc, description],
    );
    const event = db
      .query("SELECT * FROM calendar_event WHERE id = ?")
      .get(Number(result.lastInsertRowid)) as z.infer<typeof EventSchema>;
    return c.json(event, 201);
  });

  const deleteRoute = createRoute({
    method: "delete",
    path: "/api/events/{id}",
    summary: "Delete a calendar event",
    responses: {
      204: { description: "No Content" },
      401: { content: { "application/json": { schema: ErrorResponse } }, description: "Unauthorized" },
      404: { content: { "application/json": { schema: ErrorResponse } }, description: "Not found" },
    },
  });

  app.openApiRoute(deleteRoute, async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json({ ok: false, error: "Authentication required" }, 401);
    const id = parseInt(c.req.param("id"), 10);
    const event = db
      .query("SELECT id FROM calendar_event WHERE id = ? AND user_id = ?")
      .get(id, userId) as { id: number } | null;
    if (!event) return c.json({ ok: false, error: "Event not found" }, 404);
    db.run("DELETE FROM calendar_event WHERE id = ?", [id]);
    return c.body(null, 204);
  });
}
