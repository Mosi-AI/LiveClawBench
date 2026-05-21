import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import { z } from "zod";
import { readFileSync, copyFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  ListStorePacksResponseSchema,
  AcquirePackParamSchema,
} from "../schemas.js";
import type { DbState } from "../types.js";

function resolveStoreAssetsDir(): string {
  if (process.env.CHAT_STORE_ASSETS_DIR) return process.env.CHAT_STORE_ASSETS_DIR;
  const candidates = [
    "/opt/mock/static/store",
    join(import.meta.dir, "../../static/store"),
    join(import.meta.dir, "../static/store"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return "/opt/mock/static/store";
}

const STORE_ASSETS_DIR = resolveStoreAssetsDir();

function getPreviewFilenames(previewsJson: string): { filename: string; label: string }[] {
  try {
    return JSON.parse(previewsJson) as { filename: string; label: string }[];
  } catch {
    return [];
  }
}

export function registerStoreRoutes(app: OpenAPIApp, dbState: DbState) {
  const { config } = dbState;

  // GET /api/store/packs
  const listRoute = createRoute({
    method: "get",
    path: "/api/store/packs",
    summary: "List sticker packs",
    responses: {
      200: {
        content: {
          "application/json": { schema: ListStorePacksResponseSchema },
        },
        description: "OK",
      },
    },
  });

  app.openApiRoute(listRoute, (c) => {
    const db = dbState.db;
    if (!db) return c.json({ error: "service_not_ready" }, 503);

    const packRows = db
      .query("SELECT id, title, provider_name, previews_json FROM sticker_pack ORDER BY sort_order ASC, id ASC")
      .all() as { id: number; title: string; provider_name: string; previews_json: string }[];

    const acquiredRows = db
      .query("SELECT sticker_pack_id FROM user_sticker_pack WHERE user_id = 1")
      .all() as { sticker_pack_id: number }[];
    const acquiredSet = new Set(acquiredRows.map((r) => r.sticker_pack_id));

    const packs = packRows.map((row) => {
      const previews = getPreviewFilenames(row.previews_json);
      return {
        id: row.id,
        title: row.title,
        provider_name: row.provider_name,
        previews,
        acquired: acquiredSet.has(row.id),
      };
    });

    return c.json({ packs });
  });

  // POST /api/store/packs/:id/acquire
  const acquireRoute = createRoute({
    method: "post",
    path: "/api/store/packs/{id}/acquire",
    summary: "Acquire a sticker pack",
    request: {
      params: AcquirePackParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ acquired: z.boolean() }) },
        },
        description: "OK",
      },
      404: {
        content: {
          "application/json": { schema: z.object({ error: z.string() }) },
        },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(acquireRoute, (c) => {
    const db = dbState.db;
    if (!db) return c.json({ error: "service_not_ready" }, 503);

    const { id } = c.req.valid("param");

    const pack = db
      .query("SELECT id, previews_json FROM sticker_pack WHERE id = ?")
      .get(id) as { id: number; previews_json: string } | null;

    if (!pack) {
      return c.json({ error: "not_found" }, 404);
    }

    const previews = getPreviewFilenames(pack.previews_json);
    const acquiredAt = new Date().toISOString();

    // Copy files first (outside transaction) so DB rollback doesn't orphan files
    const copiedFiles: string[] = [];
    const stickerInserts: { storagePath: string; sortOrder: number }[] = [];
    let nextSort = 0;

    for (const preview of previews) {
      const srcPath = join(STORE_ASSETS_DIR, preview.filename);
      const uuid = crypto.randomUUID();
      const destFilename = `${uuid}.svg`;
      const destPath = join(config.stickerDir, destFilename);
      const storagePath = `/static/chat/stickers/${destFilename}`;

      copyFileSync(srcPath, destPath);
      copiedFiles.push(destPath);

      stickerInserts.push({ storagePath, sortOrder: nextSort });
      nextSort++;
    }

    try {
      const tx = db.transaction(() => {
        // Idempotent insert using INSERT OR IGNORE
        db.run(
          "INSERT OR IGNORE INTO user_sticker_pack (user_id, sticker_pack_id, acquired_at) VALUES (?, ?, ?)",
          [1, id, acquiredAt],
        );

        // Check if we actually inserted (not a no-op duplicate)
        const changes = db.query("SELECT changes() as c").get() as { c: number };
        if (changes.c === 0) {
          // Already acquired — no sticker inserts needed
          return;
        }

        // Re-fetch max sort_order inside transaction for correctness under concurrency
        const maxSort = db
          .query("SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM user_sticker WHERE category = ?")
          .get("recent") as { max_sort: number } | null;
        let sortOffset = (maxSort?.max_sort ?? -1) + 1;

        for (let i = 0; i < stickerInserts.length; i++) {
          const item = stickerInserts[i];
          db.run(
            "INSERT INTO user_sticker (user_id, pack_id, category, storage_path, mime_type, created_at, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [1, id, "recent", item.storagePath, "image/svg+xml", acquiredAt, sortOffset + i],
          );
        }
      });

      tx();
    } catch (err) {
      // Rollback copied files on any DB failure
      for (const f of copiedFiles) {
        try { unlinkSync(f); } catch { /* ignore */ }
      }
      return c.json({ error: "db_error" }, 500);
    }

    return c.json({ acquired: true }, 200);
  });
}
