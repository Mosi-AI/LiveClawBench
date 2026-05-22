import type { OpenAPIApp } from "mock-lib";
import { createRoute, err, ok } from "mock-lib";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import { getNoteByIdOwned, listRevisions } from "../data/store.js";
import { RevisionResponseSchema } from "../schemas.js";

export function registerRevisionRoutes(app: OpenAPIApp, db: Database): void {
  const listRevisionsRoute = createRoute({
    method: "get",
    path: "/api/notes/{id}/revisions",
    summary: "List revisions",
    request: {
      params: z.object({ id: z.coerce.number() }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(RevisionResponseSchema),
          },
        },
        description: "List of revisions",
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

  app.openApiRoute(listRevisionsRoute, (c) => {
    const userId = c.get("userId") as number;
    const { id } = c.req.valid("param");
    const note = getNoteByIdOwned(db, id, userId);
    if (!note) return c.json(err("Note not found"), 404);
    const revisions = listRevisions(db, id);
    return c.json(ok(revisions), 200);
  });
}
