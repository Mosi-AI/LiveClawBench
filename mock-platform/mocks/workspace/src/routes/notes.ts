import type { OpenAPIApp } from "mock-lib";
import { createRoute, err, ok } from "mock-lib";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import { createNote, getNoteById, getNoteByIdOwned, updateNote, deleteNote, listNotes, getLatestRevision } from "../data/store.js";
import { NoteResponseSchema, NoteDetailResponseSchema, NoteCreateSchema, NoteUpdateSchema } from "../schemas.js";

export function registerNoteRoutes(app: OpenAPIApp, db: Database): void {
  const listRoute = createRoute({
    method: "get",
    path: "/api/notes",
    summary: "List notes",
    request: {
      query: z.object({
        seeded: z.string().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(NoteResponseSchema),
          },
        },
        description: "List of notes",
      },
      401: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Unauthorized",
      },
    },
  });

  app.openApiRoute(listRoute, (c) => {
    const userId = c.get("userId") as number;
    const seededParam = c.req.query("seeded");
    const seededOnly = seededParam === "1";
    const notes = listNotes(db, userId, seededOnly);
    return c.json(ok(notes), 200);
  });

  const createRouteDef = createRoute({
    method: "post",
    path: "/api/notes",
    summary: "Create note",
    request: {
      body: {
        content: {
          "application/json": {
            schema: NoteCreateSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: NoteResponseSchema,
          },
        },
        description: "Note created",
      },
      401: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Unauthorized",
      },
    },
  });

  app.openApiRoute(createRouteDef, (c) => {
    const userId = c.get("userId") as number;
    const body = c.req.valid("json");
    const note = createNote(db, userId, body.title, body.content, body.content_type);
    return c.json(ok(note), 200);
  });

  const getRoute = createRoute({
    method: "get",
    path: "/api/notes/{id}",
    summary: "Get note",
    request: {
      params: z.object({ id: z.coerce.number() }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: NoteDetailResponseSchema,
          },
        },
        description: "Note detail",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(getRoute, (c) => {
    const userId = c.get("userId") as number;
    const { id } = c.req.valid("param");
    const note = getNoteByIdOwned(db, id, userId);
    if (!note) return c.json(err("Note not found"), 404);
    const latestRevision = getLatestRevision(db, id);
    return c.json(ok({ ...note, latest_revision: latestRevision }), 200);
  });

  const updateRouteDef = createRoute({
    method: "put",
    path: "/api/notes/{id}",
    summary: "Update note",
    request: {
      params: z.object({ id: z.coerce.number() }),
      body: {
        content: {
          "application/json": {
            schema: NoteUpdateSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean() }),
          },
        },
        description: "Note updated",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(updateRouteDef, (c) => {
    const userId = c.get("userId") as number;
    const { id } = c.req.valid("param");
    const note = getNoteByIdOwned(db, id, userId);
    if (!note) return c.json(err("Note not found"), 404);
    const body = c.req.valid("json");
    const updated = updateNote(db, id, body.title, body.content, body.content_type, userId);
    if (!updated) return c.json(err("Note not found"), 404);
    return c.json(ok({}), 200);
  });

  const deleteRoute = createRoute({
    method: "delete",
    path: "/api/notes/{id}",
    summary: "Delete note",
    request: {
      params: z.object({ id: z.coerce.number() }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean() }),
          },
        },
        description: "Note deleted",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(deleteRoute, (c) => {
    const userId = c.get("userId") as number;
    const { id } = c.req.valid("param");
    const note = getNoteByIdOwned(db, id, userId);
    if (!note) return c.json(err("Note not found"), 404);
    const deleted = deleteNote(db, id);
    if (!deleted) return c.json(err("Note not found"), 404);
    return c.json(ok({}), 200);
  });
}
