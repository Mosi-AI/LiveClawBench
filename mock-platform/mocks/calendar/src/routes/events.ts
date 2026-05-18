import { z } from "zod";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { err, getAuthUserId } from "../helpers";

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
    if (!userId) return c.json(err("Authentication required"), 401);
    const events = db
      .query("SELECT * FROM calendar_event WHERE user_id = ? ORDER BY start_time ASC")
      .all(userId) as z.infer<typeof EventSchema>[];
    return c.json({ ok: true, events });
  });

  const getRoute = createRoute({
    method: "get",
    path: "/api/events/:id",
    summary: "Get a single calendar event",
    responses: {
      200: { content: { "application/json": { schema: z.object({ ok: z.boolean(), event: EventSchema }) } }, description: "OK" },
      401: { content: { "application/json": { schema: ErrorResponse } }, description: "Unauthorized" },
      404: { content: { "application/json": { schema: ErrorResponse } }, description: "Not found" },
    },
  });

  app.openApiRoute(getRoute, async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json(err("Authentication required"), 401);
    const id = parseInt(c.req.param("id"), 10);
    const event = db
      .query("SELECT * FROM calendar_event WHERE id = ? AND user_id = ?")
      .get(id, userId) as z.infer<typeof EventSchema> | null;
    if (!event) return c.json(err("Event not found"), 404);
    return c.json({ ok: true, event });
  });
}
