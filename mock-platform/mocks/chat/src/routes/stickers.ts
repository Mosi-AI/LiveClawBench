import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import { z } from "zod";
import { writeFileSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";
import {
  ListStickersQuerySchema,
  ListStickersResponseSchema,
  StickerSchema,
  StickerIdParamSchema,
  PatchStickerBodySchema,
} from "../schemas.js";
import type { DbState, Sticker } from "../types.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/gif", "image/png", "image/jpeg"]);

function mimeToExt(mime: string): string {
  switch (mime) {
    case "image/gif":
      return "gif";
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    default:
      return "bin";
  }
}

function rowToSticker(row: Record<string, unknown>): Sticker {
  return {
    id: row.id as number,
    user_id: row.user_id as number,
    pack_id: (row.pack_id as number | null) ?? null,
    category: row.category as Sticker["category"],
    storage_path: row.storage_path as string,
    mime_type: row.mime_type as Sticker["mime_type"],
    created_at: row.created_at as string,
    sort_order: row.sort_order as number,
  };
}

export function registerStickerRoutes(app: OpenAPIApp, dbState: DbState) {
  const { config } = dbState;

  // GET /api/stickers
  const listRoute = createRoute({
    method: "get",
    path: "/api/stickers",
    summary: "List stickers",
    request: {
      query: ListStickersQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: ListStickersResponseSchema,
          },
        },
        description: "OK",
      },
    },
  });

  app.openApiRoute(listRoute, (c) => {
    const db = dbState.db;
    if (!db) return c.json({ error: "service_not_ready" }, 503);

    const { category } = c.req.valid("query");

    let query =
      "SELECT id, user_id, pack_id, category, storage_path, mime_type, created_at, sort_order FROM user_sticker";
    const params: (string | number)[] = [];

    if (category) {
      query += " WHERE category = ?";
      params.push(category);
    }

    query += " ORDER BY sort_order ASC, created_at DESC";

    const rows = db.query(query).all(...params) as Record<string, unknown>[];
    const stickers = rows.map(rowToSticker);

    return c.json({ stickers });
  });

  // GET /api/stickers/:id
  const getRoute = createRoute({
    method: "get",
    path: "/api/stickers/{id}",
    summary: "Get a sticker",
    request: {
      params: StickerIdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: StickerSchema,
          },
        },
        description: "OK",
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
    const db = dbState.db;
    if (!db) return c.json({ error: "service_not_ready" }, 503);

    const { id } = c.req.valid("param");
    const row = db
      .query(
        "SELECT id, user_id, pack_id, category, storage_path, mime_type, created_at, sort_order FROM user_sticker WHERE id = ?",
      )
      .get(id) as Record<string, unknown> | null;

    if (!row) {
      return c.json({ error: "not_found" }, 404);
    }

    return c.json(rowToSticker(row));
  });

  // POST /api/stickers — multipart upload
  const postRoute = createRoute({
    method: "post",
    path: "/api/stickers",
    summary: "Upload a sticker",
    request: {
      // For multipart, we can't easily express File in Zod for OpenAPI.
      // Use minimal request shape; validation happens in handler.
    },
    responses: {
      201: {
        content: {
          "application/json": { schema: StickerSchema },
        },
        description: "Created",
      },
      400: {
        content: {
          "application/json": { schema: z.object({ error: z.string() }) },
        },
        description: "Bad request",
      },
      413: {
        content: {
          "application/json": { schema: z.object({ error: z.string() }) },
        },
        description: "File too large",
      },
    },
  });

  app.openApiRoute(postRoute, async (c) => {
    const db = dbState.db;
    if (!db) return c.json({ error: "service_not_ready" }, 503);

    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return c.json({ error: "invalid_body" }, 400);
    }

    const formData = await c.req.parseBody();
    const file = formData["file"];
    const categoryRaw = formData["category"] ?? "custom";

    if (!file || !(file instanceof File)) {
      return c.json({ error: "invalid_body" }, 400);
    }

    const category = z
      .enum(["recent", "favorite", "custom"])
      .safeParse(categoryRaw);
    if (!category.success) {
      return c.json({ error: "invalid_category" }, 400);
    }

    if (file.size === 0) {
      return c.json({ error: "empty_file" }, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: "file_too_large" }, 413);
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return c.json({ error: "unsupported_mime" }, 400);
    }

    const uuid = crypto.randomUUID();
    const ext = mimeToExt(file.type);
    const filename = `${uuid}.${ext}`;
    const filePath = join(config.stickerDir, filename);
    const storagePath = `/static/chat/stickers/${filename}`;

    const buffer = await file.arrayBuffer();
    writeFileSync(filePath, new Uint8Array(buffer));

    try {
      const maxSort = db
        .query(
          "SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM user_sticker WHERE category = ?",
        )
        .get(category.data) as { max_sort: number } | null;
      const sortOrder = (maxSort?.max_sort ?? -1) + 1;

      const createdAt = new Date().toISOString();

      const result = db.run(
        "INSERT INTO user_sticker (user_id, category, storage_path, mime_type, created_at, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
        [1, category.data, storagePath, file.type, createdAt, sortOrder],
      );

      const sticker: Sticker = {
        id: Number(result.lastInsertRowid),
        user_id: 1,
        category: category.data,
        storage_path: storagePath,
        mime_type: file.type as "image/gif" | "image/png" | "image/jpeg",
        created_at: createdAt,
        sort_order: sortOrder,
      };

      return c.json(sticker, 201);
    } catch {
      try { unlinkSync(filePath); } catch { /* ignore */ }
      return c.json({ error: "db_error" }, 500);
    }
  });

  // PATCH /api/stickers/:id
  const patchRoute = createRoute({
    method: "patch",
    path: "/api/stickers/{id}",
    summary: "Update a sticker",
    request: {
      params: StickerIdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: StickerSchema },
        },
        description: "OK",
      },
      400: {
        content: {
          "application/json": { schema: z.object({ error: z.string() }) },
        },
        description: "Bad request",
      },
      404: {
        content: {
          "application/json": { schema: z.object({ error: z.string() }) },
        },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(patchRoute, async (c) => {
    const db = dbState.db;
    if (!db) return c.json({ error: "service_not_ready" }, 503);

    const { id } = c.req.valid("param");

    const sticker = db
      .query("SELECT id, user_id, pack_id, category, storage_path, mime_type, created_at, sort_order FROM user_sticker WHERE id = ?")
      .get(id) as Record<string, unknown> | null;

    if (!sticker) {
      return c.json({ error: "not_found" }, 404);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_body" }, 400);
    }
    const parsed = PatchStickerBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_body" }, 400);
    }

    const { category, sort_order } = parsed.data;
    const currentCategory = sticker.category as Sticker["category"];
    const targetCategory = category ?? currentCategory;
    const isCategoryChange = category && category !== currentCategory;

    // Validate category if provided
    if (category && !["recent", "favorite", "custom"].includes(category)) {
      return c.json({ error: "invalid_category" }, 400);
    }

    // Compute the target sort_order.
    // When moving categories, the valid range is [0, count_of_target_category],
    // where count includes the space the moving sticker will occupy.
    let targetSortOrder: number;
    if (sort_order !== undefined) {
      const countQuery = isCategoryChange
        ? "SELECT COUNT(*) as count FROM user_sticker WHERE category = ? AND id != ?"
        : "SELECT COUNT(*) as count FROM user_sticker WHERE category = ?";
      const countParams = isCategoryChange ? [targetCategory, id] : [targetCategory];
      const countRow = db.query(countQuery).get(...countParams) as { count: number } | null;
      // Clamp to [0, count] — count is the new valid max index after insertion
      targetSortOrder = Math.max(0, Math.min(sort_order, (countRow?.count ?? 0)));
    } else if (isCategoryChange) {
      // Category change without explicit sort_order: append to end
      const maxSort = db
        .query("SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM user_sticker WHERE category = ?")
        .get(category) as { max_sort: number } | null;
      targetSortOrder = (maxSort?.max_sort ?? -1) + 1;
    } else {
      // No change
      targetSortOrder = sticker.sort_order as number;
    }

    // Update the sticker
    db.run(
      "UPDATE user_sticker SET category = ?, sort_order = ? WHERE id = ?",
      [targetCategory, targetSortOrder, id],
    );

    // Renumber affected categories sequentially from 0
    const tx = db.transaction(() => {
      if (isCategoryChange) {
        // Renumber the old category to eliminate gaps
        const oldRows = db
          .query("SELECT id FROM user_sticker WHERE category = ? ORDER BY sort_order ASC, id ASC")
          .all(currentCategory) as { id: number }[];
        for (let i = 0; i < oldRows.length; i++) {
          db.run("UPDATE user_sticker SET sort_order = ? WHERE id = ?", [i, oldRows[i].id]);
        }
      }

      // Renumber the target category
      const targetRows = db
        .query("SELECT id FROM user_sticker WHERE category = ? ORDER BY sort_order ASC, id ASC")
        .all(targetCategory) as { id: number }[];
      for (let i = 0; i < targetRows.length; i++) {
        db.run("UPDATE user_sticker SET sort_order = ? WHERE id = ?", [i, targetRows[i].id]);
      }
    });
    tx();

    // Fetch updated sticker
    const updatedRow = db
      .query("SELECT id, user_id, pack_id, category, storage_path, mime_type, created_at, sort_order FROM user_sticker WHERE id = ?")
      .get(id) as Record<string, unknown>;

    return c.json(rowToSticker(updatedRow));
  });

  // DELETE /api/stickers/:id
  const deleteRoute = createRoute({
    method: "delete",
    path: "/api/stickers/{id}",
    summary: "Delete a sticker",
    request: {
      params: StickerIdParamSchema,
    },
    responses: {
      204: {
        description: "Deleted",
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
    const db = dbState.db;
    if (!db) return c.json({ error: "service_not_ready" }, 503);

    const { id } = c.req.valid("param");

    const row = db
      .query("SELECT storage_path FROM user_sticker WHERE id = ?")
      .get(id) as { storage_path: string } | null;

    if (!row) {
      return c.json({ error: "not_found" }, 404);
    }

    try {
      unlinkSync(join(config.stickerDir, basename(row.storage_path)));
    } catch {
      // Silently ignore if file does not exist
    }

    db.run("DELETE FROM user_sticker WHERE id = ?", [id]);

    return c.body(null, 204);
  });
}
