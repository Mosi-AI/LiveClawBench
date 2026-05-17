import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { ok } from "mock-lib";
import { OkSchema, CalendarEventSchema } from "../schemas";
import { z } from "zod";

export function registerCalendarRoutes(app: OpenAPIApp, db: Database, prefix: string): void {
  const eventsResponse = OkSchema(z.object({ events: z.array(CalendarEventSchema) }));

  const eventsRoute = createRoute({
    method: "get",
    path: `${prefix}/calendar/events`,
    summary: "List calendar events",
    request: {
      query: z.object({
        start_date: z.string().optional(),
        end_date: z.string().optional(),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: eventsResponse } },
        description: "OK",
      },
    },
  });

  app.openApiRoute(eventsRoute, (c) => {
    const query = c.req.valid("query");
    const startDate = query.start_date;
    const endDate = query.end_date;

    const userId = c.get("userId")!;
    let sql = "SELECT * FROM calendar_events WHERE user_id = ?";
    const params: (number | string)[] = [userId];

    if (startDate) {
      sql += " AND start_time >= ?";
      params.push(startDate);
    }
    if (endDate) {
      sql += " AND end_time <= ?";
      params.push(endDate);
    }

    const items = db.query(`${sql} ORDER BY start_time`).all(...params) as Record<string, unknown>[];
    return c.json(ok({ events: items }));
  });
}
