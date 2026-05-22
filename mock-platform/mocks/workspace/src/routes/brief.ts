import type { OpenAPIApp } from "mock-lib";
import { createRoute, err, ok } from "mock-lib";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import { getNoteByIdOwned, getBriefEntry, upsertBriefEntry, recomputeNotePreviewFromBrief } from "../data/store.js";
import { BriefPayloadSchema, BriefResponseSchema } from "../schemas.js";

export function registerBriefRoutes(app: OpenAPIApp, db: Database): void {
  const getRoute = createRoute({
    method: "get",
    path: "/api/notes/{id}/brief",
    summary: "Get brief entry for note",
    request: {
      params: z.object({ id: z.coerce.number() }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: BriefResponseSchema,
          },
        },
        description: "Brief entry found",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Note or brief not found",
      },
    },
  });

  app.openApiRoute(getRoute, (c) => {
    const userId = c.get("userId") as number;
    const { id } = c.req.valid("param");
    const note = getNoteByIdOwned(db, id, userId);
    if (!note) return c.json(err("Note not found"), 404);
    const brief = getBriefEntry(db, id);
    if (!brief) return c.json(err("Brief not found"), 404);
    return c.json(ok(brief), 200);
  });

  const putRoute = createRoute({
    method: "put",
    path: "/api/notes/{id}/brief",
    summary: "Upsert brief entry for note",
    request: {
      params: z.object({ id: z.coerce.number() }),
      body: {
        content: {
          "application/json": {
            schema: BriefPayloadSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: BriefResponseSchema,
          },
        },
        description: "Brief upserted",
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
    const brief = upsertBriefEntry(
      db,
      id,
      body.key_updates,
      body.evidence_bullets,
      body.action_items,
      body.citations,
      body.status,
    );
    recomputeNotePreviewFromBrief(db, id);
    return c.json(ok(brief), 200);
  });
}
