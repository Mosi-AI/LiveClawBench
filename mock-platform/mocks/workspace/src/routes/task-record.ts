import type { OpenAPIApp } from "mock-lib";
import { createRoute, err, ok } from "mock-lib";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import { getNoteByIdOwned, getTaskRecord, upsertTaskRecord } from "../data/store.js";
import { TaskRecordPayloadSchema, TaskRecordResponseSchema } from "../schemas.js";

export function registerTaskRecordRoutes(app: OpenAPIApp, db: Database): void {
  const getRoute = createRoute({
    method: "get",
    path: "/api/notes/{id}/task-record",
    summary: "Get task record",
    request: {
      params: z.object({ id: z.coerce.number() }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: TaskRecordResponseSchema.nullable(),
          },
        },
        description: "Task record or null",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Note not found",
      },
    },
  });

  app.openApiRoute(getRoute, (c) => {
    const userId = c.get("userId") as number;
    const { id } = c.req.valid("param");
    const note = getNoteByIdOwned(db, id, userId);
    if (!note) return c.json(err("Note not found"), 404);
    const record = getTaskRecord(db, id);
    return c.json(ok(record), 200);
  });

  const putRoute = createRoute({
    method: "put",
    path: "/api/notes/{id}/task-record",
    summary: "Upsert task record",
    request: {
      params: z.object({ id: z.coerce.number() }),
      body: {
        content: {
          "application/json": {
            schema: TaskRecordPayloadSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: TaskRecordResponseSchema,
          },
        },
        description: "Task record upserted",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Note not found",
      },
    },
  });

  app.openApiRoute(putRoute, (c) => {
    const userId = c.get("userId") as number;
    const { id } = c.req.valid("param");
    const note = getNoteByIdOwned(db, id, userId);
    if (!note) return c.json(err("Note not found"), 404);

    const body = c.req.valid("json");
    const existing = getTaskRecord(db, id);
    const record = upsertTaskRecord(
      db,
      id,
      body.record_type ?? existing?.record_type ?? "summary",
      body.source_channel ?? existing?.source_channel ?? "manual",
      body.summary_text ?? existing?.summary_text ?? "",
      body.status ?? existing?.status ?? "open",
    );
    return c.json(ok(record), 200);
  });
}
