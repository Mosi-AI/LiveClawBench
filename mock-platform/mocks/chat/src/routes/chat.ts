import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import { z } from "zod";
import {
  ListChannelsResponseSchema,
  ListMessagesResponseSchema,
  SendMessageBodySchema,
  ChannelIdParamSchema,
} from "../schemas.js";
import type { DbState } from "../types.js";

export function registerChatRoutes(app: OpenAPIApp, dbState: DbState) {
  // GET /api/channels
  const listChannelsRoute = createRoute({
    method: "get",
    path: "/api/channels",
    summary: "List channels",
    responses: {
      200: {
        content: {
          "application/json": { schema: ListChannelsResponseSchema },
        },
        description: "OK",
      },
    },
  });

  app.openApiRoute(listChannelsRoute, (c) => {
    const db = dbState.db;
    if (!db) return c.json({ error: "service_not_ready" }, 503);

    const rows = db
      .query("SELECT id, user_id, name, kind, last_message_preview, updated_at, unread_count FROM channel ORDER BY id ASC")
      .all() as { id: number; user_id: number; name: string; kind: string; last_message_preview: string | null; updated_at: string; unread_count: number }[];

    const channels = rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      kind: row.kind as "direct" | "group" | "system",
      last_message_preview: row.last_message_preview,
      updated_at: row.updated_at,
      unread_count: row.unread_count,
    }));

    return c.json({ channels });
  });

  // GET /api/channels/:id/messages
  const listMessagesRoute = createRoute({
    method: "get",
    path: "/api/channels/{id}/messages",
    summary: "Get messages in a channel",
    request: {
      params: ChannelIdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: ListMessagesResponseSchema },
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

  app.openApiRoute(listMessagesRoute, (c) => {
    const db = dbState.db;
    if (!db) return c.json({ error: "service_not_ready" }, 503);

    const { id } = c.req.valid("param");

    const channel = db.query("SELECT 1 FROM channel WHERE id = ?").get(id) as { "1": number } | null;
    if (!channel) {
      return c.json({ error: "not_found" }, 404);
    }

    const rows = db
      .query("SELECT id, channel_id, sender, body, sent_at, message_kind, source_ref FROM message WHERE channel_id = ? ORDER BY sent_at ASC")
      .all(id) as { id: number; channel_id: number; sender: string; body: string; sent_at: string; message_kind: string; source_ref: string | null }[];

    const messages = rows.map((row) => ({
      id: row.id,
      channel_id: row.channel_id,
      sender: row.sender,
      body: row.body,
      sent_at: row.sent_at,
      message_kind: row.message_kind as "chat" | "structured_brief" | "thread_sync" | "sticker",
      source_ref: row.source_ref,
    }));

    return c.json({ messages });
  });

  // POST /api/channels/:id/messages
  const sendMessageRoute = createRoute({
    method: "post",
    path: "/api/channels/{id}/messages",
    summary: "Send a message",
    request: {
      params: ChannelIdParamSchema,
    },
    responses: {
      201: {
        content: {
          "application/json": { schema: z.object({ id: z.number() }) },
        },
        description: "Created",
      },
      400: {
        content: {
          "application/json": { schema: z.object({ error: z.string() }) },
        },
        description: "Bad request",
      },
      403: {
        content: {
          "application/json": { schema: z.object({ error: z.string() }) },
        },
        description: "Forbidden",
      },
      404: {
        content: {
          "application/json": { schema: z.object({ error: z.string() }) },
        },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(sendMessageRoute, async (c) => {
    const db = dbState.db;
    if (!db) return c.json({ error: "service_not_ready" }, 503);

    const { id } = c.req.valid("param");

    const channel = db.query("SELECT 1 FROM channel WHERE id = ?").get(id) as { "1": number } | null;
    if (!channel) {
      return c.json({ error: "not_found" }, 404);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_body" }, 400);
    }
    const parsed = SendMessageBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_body" }, 400);
    }

    const { message_kind, sticker_id } = parsed.data;
    let messageBody = parsed.data.body ?? "";
    let sourceRef: string | null = null;

    if (message_kind === "chat") {
      if (!messageBody || messageBody.trim().length === 0) {
        return c.json({ error: "missing_body" }, 400);
      }
    } else if (message_kind === "sticker") {
      if (!sticker_id) {
        return c.json({ error: "missing_sticker_id" }, 400);
      }

      const sticker = db
        .query("SELECT id, storage_path, user_id, pack_id FROM user_sticker WHERE id = ?")
        .get(sticker_id) as { id: number; storage_path: string; user_id: number; pack_id: number | null } | null;

      if (!sticker) {
        return c.json({ error: "sticker_not_found" }, 400);
      }

      if (sticker.user_id !== 1) {
        return c.json({ error: "sticker_not_owned" }, 403);
      }

      sourceRef = String(sticker.id);

      if (sticker.pack_id != null) {
        // Determine 0-based index of this sticker within its pack
        const indexRow = db
          .query("SELECT COUNT(*) as count FROM user_sticker WHERE pack_id = ? AND id < ?")
          .get(sticker.pack_id, sticker.id) as { count: number } | null;
        const index = indexRow?.count ?? 0;

        const packRow = db
          .query("SELECT previews_json FROM sticker_pack WHERE id = ?")
          .get(sticker.pack_id) as { previews_json: string } | null;

        let label: string | undefined;
        if (packRow) {
          try {
            const previews = JSON.parse(packRow.previews_json) as { filename: string; label: string }[];
            label = previews[index]?.label;
          } catch {
            // ignore parse errors
          }
        }
        messageBody = `[sticker: ${label ?? "sticker"}]`;
      } else {
        messageBody = "[sticker: custom]";
      }
    }

    const sentAt = new Date().toISOString();

    const result = db.run(
      "INSERT INTO message (channel_id, sender, body, sent_at, message_kind, source_ref) VALUES (?, ?, ?, ?, ?, ?)",
      [id, "You", messageBody, sentAt, message_kind, sourceRef],
    );

    return c.json({ id: Number(result.lastInsertRowid) }, 201);
  });
}
